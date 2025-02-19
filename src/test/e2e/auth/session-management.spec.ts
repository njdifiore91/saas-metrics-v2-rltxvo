import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'jest';
import supertest from 'supertest';
import winston from 'winston';
import { setupTestServer, teardownTestServer } from '../../utils/test-server';
import { generateTestToken, generateExpiredToken } from '../../utils/jwt-helpers';
import { User, UserRole } from '../../../backend/src/shared/interfaces/user.interface';
import { HTTP_STATUS_CODES, AUTH_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('Session Management E2E Tests', () => {
  let testServer: any;
  let testAgent: supertest.SuperTest<supertest.Test>;
  let testLogger: winston.Logger;

  // Test user data
  const testUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@company.com',
    name: 'Test User',
    role: UserRole.USER,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    isActive: true
  };

  beforeAll(async () => {
    // Initialize test environment
    await setupTestServer();
    testLogger = winston.createLogger({
      transports: [new winston.transports.Console()],
      silent: process.env.NODE_ENV === 'test'
    });
  });

  afterAll(async () => {
    // Cleanup test environment
    await teardownTestServer();
  });

  beforeEach(() => {
    // Reset rate limiters and session data before each test
    jest.setTimeout(10000);
  });

  afterEach(async () => {
    // Clear any test sessions
    jest.clearAllMocks();
  });

  describe('JWT Token Lifecycle Tests', () => {
    it('should validate a valid RS256-signed JWT token', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        permissions: ['read', 'write']
      });

      const response = await supertest(testServer)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Correlation-ID', 'test-correlation-id');

      expect(response.status).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser.id);
    });

    it('should reject an expired JWT token', async () => {
      const expiredToken = generateExpiredToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role
      });

      const response = await supertest(testServer)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('X-Correlation-ID', 'test-correlation-id');

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH001);
    });

    it('should refresh token before expiration', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        expiresIn: '30s'
      });

      const response = await supertest(testServer)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Correlation-ID', 'test-correlation-id');

      expect(response.status).toBe(HTTP_STATUS_CODES.OK);
      expect(response.body.success).toBe(true);
      expect(response.headers['x-refresh-token']).toBeDefined();
    });
  });

  describe('Concurrent Session Management Tests', () => {
    it('should enforce maximum concurrent session limit', async () => {
      const sessions = await Promise.all([1, 2, 3, 4].map(async (i) => {
        const token = generateTestToken({
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
          sessionId: `test-session-${i}`
        });

        return supertest(testServer)
          .post('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Correlation-ID', `test-correlation-id-${i}`);
      }));

      // First 3 sessions should succeed
      expect(sessions[0].status).toBe(HTTP_STATUS_CODES.CREATED);
      expect(sessions[1].status).toBe(HTTP_STATUS_CODES.CREATED);
      expect(sessions[2].status).toBe(HTTP_STATUS_CODES.CREATED);

      // 4th session should fail due to limit
      expect(sessions[3].status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(sessions[3].body.code).toBe(AUTH_ERRORS.AUTH005);
    });

    it('should invalidate oldest session when limit exceeded', async () => {
      // Create maximum allowed sessions
      const sessions = await Promise.all([1, 2, 3].map(async (i) => {
        const token = generateTestToken({
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
          sessionId: `test-session-${i}`
        });

        return supertest(testServer)
          .post('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${token}`);
      }));

      // Attempt to create new session
      const newToken = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        sessionId: 'test-session-4'
      });

      const response = await supertest(testServer)
        .post('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.CREATED);

      // Verify oldest session is invalidated
      const oldestSessionResponse = await supertest(testServer)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${sessions[0].body.token}`);

      expect(oldestSessionResponse.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
    });
  });

  describe('Session Expiration Tests', () => {
    it('should handle session timeout after inactivity', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role
      });

      // Simulate time passing
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

      const response = await supertest(testServer)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH004);
    });

    it('should enforce maximum session duration', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
        expiresIn: '31d'
      });

      const response = await supertest(testServer)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH004);
    });
  });

  describe('Security Event Logging Tests', () => {
    it('should log session creation events', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role
      });

      const logSpy = jest.spyOn(testLogger, 'info');

      await supertest(testServer)
        .post('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session created'),
        expect.objectContaining({
          userId: testUser.id,
          sessionId: expect.any(String)
        })
      );
    });

    it('should log session termination events', async () => {
      const token = generateTestToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role
      });

      const logSpy = jest.spyOn(testLogger, 'info');

      await supertest(testServer)
        .delete('/api/v1/auth/sessions/current')
        .set('Authorization', `Bearer ${token}`);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session terminated'),
        expect.objectContaining({
          userId: testUser.id,
          sessionId: expect.any(String)
        })
      );
    });
  });
});