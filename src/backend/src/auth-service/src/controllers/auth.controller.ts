import { Request, Response } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v3.0.0
import { Logger } from 'winston'; // v3.8.2
import { createHash, randomBytes } from 'crypto';

import { AuthService } from '../services/auth.service';
import { User, UserRole } from '../../../shared/interfaces/user.interface';
import { AUTH_ERRORS, HTTP_STATUS_CODES, ErrorResponse } from '../../../shared/constants/error-codes';

export class AuthController {
  private readonly CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');
  private readonly COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
    domain: process.env.COOKIE_DOMAIN,
    path: '/'
  };

  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: RateLimiterRedis,
    private readonly logger: Logger
  ) {}

  /**
   * Initiates Google OAuth authentication flow with CSRF protection
   */
  public initiateGoogleAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      // Apply rate limiting
      await this.rateLimiter.consume(req.ip);

      // Generate CSRF token
      const csrfToken = randomBytes(32).toString('hex');
      const csrfHash = createHash('sha256')
        .update(csrfToken + this.CSRF_SECRET)
        .digest('hex');

      // Set CSRF cookie
      res.cookie('csrf_token', csrfHash, this.COOKIE_OPTIONS);

      // Generate state parameter with CSRF token
      const state = Buffer.from(JSON.stringify({ csrfToken, timestamp: Date.now() })).toString('base64');

      // Log authentication initiation
      this.logger.info('Initiating Google OAuth flow', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      // Redirect to Google OAuth consent screen
      const authUrl = await this.authService.initiateGoogleAuth(state);
      res.redirect(authUrl);
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Handles Google OAuth callback with comprehensive security checks
   */
  public handleGoogleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.query;
      const csrfToken = req.cookies['csrf_token'];

      if (!code || !state || !csrfToken) {
        throw new Error(AUTH_ERRORS.AUTH003);
      }

      // Validate CSRF token
      const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const expectedHash = createHash('sha256')
        .update(stateData.csrfToken + this.CSRF_SECRET)
        .digest('hex');

      if (csrfToken !== expectedHash) {
        throw new Error(AUTH_ERRORS.AUTH003);
      }

      // Process OAuth callback
      const { token, user, sessionId } = await this.authService.handleGoogleCallback(
        code as string,
        state as string
      );

      // Set secure JWT cookie
      res.cookie('auth_token', token, this.COOKIE_OPTIONS);

      // Clear CSRF token
      res.clearCookie('csrf_token');

      // Log successful authentication
      this.logger.info('Authentication successful', {
        userId: user.id,
        sessionId,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(HTTP_STATUS_CODES.OK).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          lastActivity: user.lastActivity
        },
        sessionId
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Refreshes JWT token with session validation
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const currentToken = req.cookies['auth_token'];
      if (!currentToken) {
        throw new Error(AUTH_ERRORS.AUTH003);
      }

      // Verify and refresh token
      const { token, user, sessionId } = await this.authService.refreshToken(currentToken);

      // Set new token cookie
      res.cookie('auth_token', token, this.COOKIE_OPTIONS);

      // Log token refresh
      this.logger.info('Token refreshed', {
        userId: user.id,
        sessionId,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(HTTP_STATUS_CODES.OK).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          lastActivity: user.lastActivity
        },
        sessionId
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Handles user logout with comprehensive cleanup
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.cookies['auth_token'];
      if (token) {
        // Invalidate token and session
        await this.authService.invalidateToken(token);

        // Clear auth cookie
        res.clearCookie('auth_token', this.COOKIE_OPTIONS);

        // Log logout
        this.logger.info('User logged out', {
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
      }

      res.status(HTTP_STATUS_CODES.NO_CONTENT).end();
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Standardized error handler for authentication endpoints
   */
  private handleError(error: any, req: Request, res: Response): void {
    const errorResponse: ErrorResponse = {
      type: 'https://auth.api.startup-metrics.com/errors',
      status: HTTP_STATUS_CODES.UNAUTHORIZED,
      code: error.code || AUTH_ERRORS.AUTH003,
      message: error.message || 'Authentication failed',
      details: { error: error.message },
      instance: req.originalUrl
    };

    this.logger.error('Authentication error', {
      error: errorResponse,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    res.status(errorResponse.status).json(errorResponse);
  }
}