import { OAuth2Client } from 'google-auth-library'; // v8.0.0
import * as jwt from 'jsonwebtoken'; // v9.0.0
import { Redis } from 'ioredis'; // v5.0.0
import { Logger } from 'winston'; // v3.8.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v6.0.0

import { createGoogleOAuthClient, validateGoogleAuthCode } from '../config/google-oauth.config';
import { JWT_CONFIG, TokenPayload } from '../config/jwt.config';
import { AUTH_ERRORS, ErrorResponse } from '../../../shared/constants/error-codes';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: Date;
}

interface Session {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
}

export class AuthService {
  private readonly googleClient: OAuth2Client;
  private readonly rateLimiter: RateLimiterRedis;
  private readonly SESSION_PREFIX = 'session:';
  private readonly BLACKLIST_PREFIX = 'blacklist:';
  private readonly MAX_SESSIONS = 3;
  private readonly SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

  constructor(
    private readonly userModel: any,
    private readonly redisClient: Redis,
    private readonly logger: Logger
  ) {
    this.googleClient = createGoogleOAuthClient();
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'ratelimit:auth',
      points: 5, // Number of points
      duration: 60 // Per 60 seconds
    });
  }

  /**
   * Handles Google OAuth callback with enhanced security and session management
   */
  public async handleGoogleCallback(
    code: string,
    state: string
  ): Promise<{ token: string; user: User; sessionId: string }> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(state);

      // Validate Google OAuth code and get profile
      const { tokens, profile } = await validateGoogleAuthCode(
        this.googleClient,
        code,
        state
      );

      // Find or create user
      const user = await this.findOrCreateUser(profile);

      // Check and manage concurrent sessions
      await this.enforceSessionLimit(user.id);

      // Generate session ID
      const sessionId = jwt.sign({ timestamp: Date.now() }, JWT_CONFIG.privateKeyPath);

      // Create JWT token
      const token = this.generateToken(user, sessionId);

      // Create session record
      await this.createSession(user.id, sessionId);

      // Update last login
      await this.userModel.updateOne(
        { id: user.id },
        { lastLogin: new Date() }
      );

      // Log successful authentication
      this.logger.info('Authentication successful', {
        userId: user.id,
        sessionId,
        timestamp: new Date().toISOString()
      });

      return { token, user, sessionId };
    } catch (error) {
      this.logger.error('Authentication failed', { error });
      throw this.formatAuthError(error);
    }
  }

  /**
   * Verifies JWT token with blacklist check and session validation
   */
  public async verifyToken(token: string): Promise<TokenPayload> {
    try {
      // Check token blacklist
      const isBlacklisted = await this.redisClient.exists(
        `${this.BLACKLIST_PREFIX}${token}`
      );
      if (isBlacklisted) {
        throw new Error(AUTH_ERRORS.AUTH001);
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_CONFIG.publicKeyPath, {
        algorithms: [JWT_CONFIG.algorithm],
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience
      }) as TokenPayload;

      // Verify session is still valid
      const session = await this.getSession(decoded.userId, decoded.sessionId);
      if (!session) {
        throw new Error(AUTH_ERRORS.AUTH004);
      }

      // Update session activity
      await this.updateSessionActivity(decoded.userId, decoded.sessionId);

      this.logger.debug('Token verified successfully', {
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });

      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed', { error });
      throw this.formatAuthError(error);
    }
  }

  /**
   * Manages user sessions with concurrent session limiting
   */
  private async manageSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);

    if (sessions.length >= this.MAX_SESSIONS) {
      // Remove oldest session
      const oldestSession = sessions.reduce((prev, curr) => 
        prev.lastActivity < curr.lastActivity ? prev : curr
      );

      await this.removeSession(userId, oldestSession.sessionId);
      this.logger.info('Removed oldest session', {
        userId,
        sessionId: oldestSession.sessionId
      });
    }

    // Update current session
    await this.updateSessionActivity(userId, sessionId);
  }

  /**
   * Private helper methods
   */
  private async findOrCreateUser(profile: any): Promise<User> {
    const user = await this.userModel.findOne({ email: profile.email });
    if (user) return user;

    return await this.userModel.create({
      email: profile.email,
      name: profile.name,
      role: 'user',
      lastLogin: new Date()
    });
  }

  private generateToken(user: User, sessionId: string): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: this.getUserPermissions(user.role),
      sessionId,
      issuedAt: Date.now()
    };

    return jwt.sign(payload, JWT_CONFIG.privateKeyPath, {
      algorithm: JWT_CONFIG.algorithm,
      expiresIn: JWT_CONFIG.expiresIn,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
  }

  private getUserPermissions(role: string): string[] {
    // Role-based permission mapping
    const permissionMap: Record<string, string[]> = {
      admin: ['read', 'write', 'delete', 'manage'],
      user: ['read', 'write'],
      guest: ['read']
    };
    return permissionMap[role] || [];
  }

  private async createSession(userId: string, sessionId: string): Promise<void> {
    const session: Session = {
      userId,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    await this.redisClient.setex(
      `${this.SESSION_PREFIX}${userId}:${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );
  }

  private async getSession(userId: string, sessionId: string): Promise<Session | null> {
    const sessionData = await this.redisClient.get(
      `${this.SESSION_PREFIX}${userId}:${sessionId}`
    );
    return sessionData ? JSON.parse(sessionData) : null;
  }

  private async getUserSessions(userId: string): Promise<Session[]> {
    const keys = await this.redisClient.keys(`${this.SESSION_PREFIX}${userId}:*`);
    const sessions: Session[] = [];

    for (const key of keys) {
      const sessionData = await this.redisClient.get(key);
      if (sessionData) {
        sessions.push(JSON.parse(sessionData));
      }
    }

    return sessions;
  }

  private async updateSessionActivity(userId: string, sessionId: string): Promise<void> {
    const session = await this.getSession(userId, sessionId);
    if (session) {
      session.lastActivity = Date.now();
      await this.redisClient.setex(
        `${this.SESSION_PREFIX}${userId}:${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify(session)
      );
    }
  }

  private async removeSession(userId: string, sessionId: string): Promise<void> {
    await this.redisClient.del(`${this.SESSION_PREFIX}${userId}:${sessionId}`);
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    if (sessions.length >= this.MAX_SESSIONS) {
      const oldestSession = sessions.reduce((prev, curr) => 
        prev.lastActivity < curr.lastActivity ? prev : curr
      );
      await this.removeSession(userId, oldestSession.sessionId);
    }
  }

  private formatAuthError(error: any): ErrorResponse {
    return {
      type: 'https://auth.api.startup-metrics.com/errors/auth-failed',
      status: 401,
      code: error.code || AUTH_ERRORS.AUTH003,
      message: error.message || 'Authentication failed',
      details: { error },
      instance: '/auth/google/callback'
    };
  }
}