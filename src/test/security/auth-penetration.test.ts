import { getTestAgent, setupTestServer, teardownTestServer } from '../utils/test-server';
import { JWT_CONFIG } from '../../backend/src/auth-service/src/config/jwt.config';
import { googleOAuthConfig } from '../../backend/src/auth-service/src/config/google-oauth.config';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../backend/src/shared/constants/error-codes';
import rateLimit from 'express-rate-limit';

// Test constants
const TEST_USER_CREDENTIALS = {
  email: 'test@example.com',
  password: 'Test123!@#',
  role: 'user'
};

const TEST_OAUTH_STATE = 'secure-random-state-value-for-testing';
const TEST_JWT_KEYS = {
  publicKey: 'test-public-key',
  privateKey: 'test-private-key'
};

describe('Authentication Security Tests', () => {
  let agent: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    await setupTestServer();
    agent = getTestAgent();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  describe('JWT Token Security Tests', () => {
    it('should detect token tampering with modified payload', async () => {
      // Generate valid token
      const validToken = jwt.sign(
        { userId: '123', role: 'user' },
        TEST_JWT_KEYS.privateKey,
        { algorithm: JWT_CONFIG.algorithm }
      );

      // Tamper with token payload
      const [header, payload, signature] = validToken.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: '123', role: 'admin' })
      ).toString('base64');

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: '123', role: 'user' },
        TEST_JWT_KEYS.privateKey,
        { 
          algorithm: JWT_CONFIG.algorithm,
          expiresIn: '0s'
        }
      );

      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH001);
    });

    it('should prevent algorithm switching attacks', async () => {
      const weakToken = jwt.sign(
        { userId: '123', role: 'user' },
        'weak-secret',
        { algorithm: 'HS256' }
      );

      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${weakToken}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should validate token issuer and audience claims', async () => {
      const invalidClaimsToken = jwt.sign(
        { 
          userId: '123',
          role: 'user',
          iss: 'invalid-issuer',
          aud: 'invalid-audience'
        },
        TEST_JWT_KEYS.privateKey,
        { algorithm: JWT_CONFIG.algorithm }
      );

      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${invalidClaimsToken}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });
  });

  describe('OAuth Flow Security Tests', () => {
    it('should validate CSRF state parameter', async () => {
      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid-code',
          state: 'invalid-state'
        });

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should prevent open redirect vulnerabilities', async () => {
      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid-code',
          state: TEST_OAUTH_STATE,
          redirect_uri: 'https://malicious-site.com'
        });

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should validate OAuth scopes', async () => {
      const response = await agent
        .get('/api/v1/auth/google')
        .query({
          scope: 'invalid-scope'
        });

      expect(response.status).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should prevent authorization code replay attacks', async () => {
      // First valid request
      await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'used-code',
          state: TEST_OAUTH_STATE
        });

      // Replay attempt
      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'used-code',
          state: TEST_OAUTH_STATE
        });

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });
  });

  describe('Session Security Tests', () => {
    it('should enforce session timeout', async () => {
      const token = await getAuthToken();
      
      // Fast-forward time
      jest.advanceTimersByTime(3600000); // 1 hour

      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH004);
    });

    it('should enforce concurrent session limits', async () => {
      // Create maximum allowed sessions
      for (let i = 0; i < 3; i++) {
        await getAuthToken();
      }

      // Attempt to create another session
      const response = await agent
        .post('/api/v1/auth/login')
        .send(TEST_USER_CREDENTIALS);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH005);
    });

    it('should properly handle session revocation', async () => {
      const token = await getAuthToken();

      // Revoke session
      await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Attempt to use revoked token
      const response = await agent
        .get('/api/v1/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(response.body.code).toBe(AUTH_ERRORS.AUTH001);
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce login attempt rate limits', async () => {
      // Exceed rate limit
      for (let i = 0; i < 11; i++) {
        await agent
          .post('/api/v1/auth/login')
          .send(TEST_USER_CREDENTIALS);
      }

      const response = await agent
        .post('/api/v1/auth/login')
        .send(TEST_USER_CREDENTIALS);

      expect(response.status).toBe(HTTP_STATUS_CODES.RATE_LIMIT);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should enforce token refresh rate limits', async () => {
      const token = await getAuthToken();

      // Exceed refresh rate limit
      for (let i = 0; i < 6; i++) {
        await agent
          .post('/api/v1/auth/refresh')
          .set('Authorization', `Bearer ${token}`);
      }

      const response = await agent
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HTTP_STATUS_CODES.RATE_LIMIT);
    });
  });

  describe('Security Headers Tests', () => {
    it('should set appropriate security headers', async () => {
      const response = await agent.get('/api/v1/auth/login');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set secure cookie attributes', async () => {
      const response = await agent
        .post('/api/v1/auth/login')
        .send(TEST_USER_CREDENTIALS);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('Secure');
      expect(cookies[0]).toContain('SameSite=Strict');
    });
  });
});

// Helper function to get auth token
async function getAuthToken(): Promise<string> {
  const response = await agent
    .post('/api/v1/auth/login')
    .send(TEST_USER_CREDENTIALS);

  return response.body.token;
}