import { OAuth2Client } from 'google-auth-library'; // v8.0.0
import { Redis } from 'ioredis'; // v5.0.0
import nock from 'nock'; // v13.0.0
import * as jwt from 'jsonwebtoken'; // v9.0.0
import { Logger } from 'winston'; // v3.8.0

import { AuthService } from '../../../backend/src/auth-service/src/services/auth.service';
import { JWT_CONFIG } from '../../../backend/src/auth-service/src/config/jwt.config';
import { AUTH_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('Google OAuth Authentication Flow', () => {
  let authService: AuthService;
  let redisClient: Redis;
  let mockUserModel: any;
  let mockLogger: Logger;
  let googleClient: OAuth2Client;

  const mockGoogleTokenResponse = {
    access_token: 'mock_access_token',
    id_token: 'mock_id_token',
    token_type: 'Bearer',
    expires_in: 3600
  };

  const mockGoogleUserProfile = {
    id: '123456789',
    email: 'test@example.com',
    verified_email: true,
    name: 'Test User',
    picture: 'https://example.com/photo.jpg'
  };

  beforeAll(async () => {
    // Setup Redis client
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 1 // Use separate DB for tests
    });

    // Setup mock user model
    mockUserModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn()
    };

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as unknown as Logger;

    // Setup Google OAuth client
    googleClient = new OAuth2Client({
      clientId: 'mock_client_id',
      clientSecret: 'mock_client_secret',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    });

    // Initialize auth service
    authService = new AuthService(mockUserModel, redisClient, mockLogger);

    // Clear Redis test database
    await redisClient.flushdb();

    // Setup nock to mock Google OAuth endpoints
    nock('https://oauth2.googleapis.com')
      .persist()
      .post('/token')
      .reply(200, mockGoogleTokenResponse);

    nock('https://www.googleapis.com')
      .persist()
      .get('/oauth2/v2/userinfo')
      .reply(200, mockGoogleUserProfile);
  });

  afterAll(async () => {
    await redisClient.quit();
    nock.cleanAll();
  });

  describe('OAuth URL Generation', () => {
    it('should generate valid Google OAuth URL with required parameters', async () => {
      const authUrl = await authService.initiateGoogleAuth();

      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('access_type=offline');
      expect(authUrl).toContain('scope=openid%20profile%20email');
      expect(authUrl).toContain('state=');
      expect(authUrl).toContain('prompt=consent');
    });
  });

  describe('OAuth Callback Handling', () => {
    const mockCode = 'valid_auth_code';
    const mockState = 'valid_state';

    it('should successfully handle OAuth callback and create session', async () => {
      mockUserModel.findOne.mockResolvedValueOnce(null);
      mockUserModel.create.mockResolvedValueOnce({
        id: '123',
        email: mockGoogleUserProfile.email,
        name: mockGoogleUserProfile.name,
        role: 'user'
      });

      const result = await authService.handleGoogleCallback(mockCode, mockState);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessionId');

      // Verify JWT token
      const decodedToken = jwt.verify(result.token, JWT_CONFIG.publicKeyPath) as any;
      expect(decodedToken).toHaveProperty('userId', '123');
      expect(decodedToken).toHaveProperty('email', mockGoogleUserProfile.email);
      expect(decodedToken).toHaveProperty('role', 'user');
      expect(decodedToken).toHaveProperty('sessionId');

      // Verify session creation
      const session = await redisClient.get(`session:123:${result.sessionId}`);
      expect(session).toBeTruthy();
      const sessionData = JSON.parse(session!);
      expect(sessionData).toHaveProperty('userId', '123');
      expect(sessionData).toHaveProperty('sessionId', result.sessionId);
    });

    it('should enforce rate limiting on OAuth callbacks', async () => {
      // Trigger rate limit
      const attempts = Array(6).fill(null);
      const attemptPromises = attempts.map(() => 
        authService.handleGoogleCallback(mockCode, mockState)
      );

      await expect(Promise.all(attemptPromises))
        .rejects.toThrow(AUTH_ERRORS.SYS001);
    });

    it('should handle existing user login', async () => {
      const existingUser = {
        id: '456',
        email: mockGoogleUserProfile.email,
        name: mockGoogleUserProfile.name,
        role: 'user'
      };

      mockUserModel.findOne.mockResolvedValueOnce(existingUser);

      const result = await authService.handleGoogleCallback(mockCode, mockState);

      expect(result.user).toEqual(existingUser);
      expect(mockUserModel.create).not.toHaveBeenCalled();
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { id: existingUser.id },
        { lastLogin: expect.any(Date) }
      );
    });
  });

  describe('Session Management', () => {
    it('should handle sliding session extension', async () => {
      const userId = '789';
      const sessionId = 'test_session';

      // Create initial session
      await authService.createSession(userId, sessionId);

      // Verify initial session
      let session = await redisClient.get(`session:${userId}:${sessionId}`);
      expect(session).toBeTruthy();

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update session activity
      await authService.validateSession(userId, sessionId);

      // Verify session extension
      session = await redisClient.get(`session:${userId}:${sessionId}`);
      const sessionData = JSON.parse(session!);
      expect(sessionData.lastActivity).toBeGreaterThan(sessionData.createdAt);
    });

    it('should enforce concurrent session limits', async () => {
      const userId = '101';
      const sessions = ['session1', 'session2', 'session3', 'session4'];

      // Create maximum allowed sessions
      for (const sessionId of sessions.slice(0, 3)) {
        await authService.createSession(userId, sessionId);
      }

      // Attempt to create additional session
      await expect(authService.createSession(userId, sessions[3]))
        .rejects.toThrow(AUTH_ERRORS.AUTH005);

      // Verify session count
      const userSessions = await redisClient.keys(`session:${userId}:*`);
      expect(userSessions.length).toBe(3);
    });
  });
});