import { setupTestServer, teardownTestServer } from '../../utils/test-server';
import supertest from 'supertest'; // v6.3.3
import nock from 'nock'; // v13.0.0
import Redis from 'redis-mock'; // v0.56.3
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { createHash } from 'crypto';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';

// Initialize test Redis client
const redisClient = new Redis();

// Mock Google OAuth endpoints
const MOCK_GOOGLE_ENDPOINTS = {
  AUTH: 'https://accounts.google.com',
  TOKEN: 'https://oauth2.googleapis.com',
  USERINFO: 'https://www.googleapis.com/oauth2/v3/userinfo'
};

// Test constants
const TEST_USER = {
  id: uuidv4(),
  email: 'test@company.com',
  name: 'Test User',
  picture: 'https://test.com/photo.jpg'
};

const TEST_TOKENS = {
  access_token: 'mock_access_token',
  id_token: 'mock_id_token',
  refresh_token: 'mock_refresh_token',
  expires_in: 3600
};

describe('Google OAuth Authentication Flow', () => {
  let app: any;
  let agent: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    // Setup test environment
    await setupTestServer();
    app = global.app;
    agent = supertest(app);

    // Configure nock for Google OAuth mocks
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(async () => {
    // Cleanup test environment
    await teardownTestServer();
    nock.cleanAll();
    nock.enableNetConnect();
    await redisClient.quit();
  });

  beforeEach(() => {
    // Reset nock interceptors before each test
    nock.cleanAll();
  });

  describe('OAuth Initialization', () => {
    it('should generate secure state parameter and redirect to Google consent screen', async () => {
      const response = await agent
        .get('/api/v1/auth/google')
        .expect(HTTP_STATUS_CODES.OK);

      // Verify CSRF token cookie
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toMatch(/csrf_token=.+; HttpOnly/);

      // Verify redirect URL
      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(MOCK_GOOGLE_ENDPOINTS.AUTH);
      expect(redirectUrl.searchParams.get('client_id')).toBeDefined();
      expect(redirectUrl.searchParams.get('redirect_uri')).toBeDefined();
      expect(redirectUrl.searchParams.get('state')).toBeDefined();
      expect(redirectUrl.searchParams.get('scope')).toContain('openid');
    });

    it('should enforce rate limiting on OAuth initialization', async () => {
      // Make multiple rapid requests
      const requests = Array(101).fill(null).map(() => 
        agent.get('/api/v1/auth/google')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(HTTP_STATUS_CODES.RATE_LIMIT);
      expect(rateLimitedResponse.body.code).toBe('SYS001');
    });
  });

  describe('OAuth Callback', () => {
    it('should handle successful OAuth callback with proper session creation', async () => {
      // Mock Google token endpoint
      nock(MOCK_GOOGLE_ENDPOINTS.TOKEN)
        .post('/token')
        .reply(200, TEST_TOKENS);

      // Mock Google userinfo endpoint
      nock(MOCK_GOOGLE_ENDPOINTS.USERINFO)
        .get('')
        .reply(200, TEST_USER);

      // Generate valid state and CSRF token
      const csrfToken = uuidv4();
      const state = Buffer.from(JSON.stringify({
        csrfToken,
        timestamp: Date.now()
      })).toString('base64');

      const csrfHash = createHash('sha256')
        .update(csrfToken + process.env.CSRF_SECRET)
        .digest('hex');

      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid_auth_code',
          state
        })
        .set('Cookie', [`csrf_token=${csrfHash}`])
        .expect(HTTP_STATUS_CODES.OK);

      // Verify JWT token
      expect(response.headers['set-cookie']).toBeDefined();
      const authCookie = response.headers['set-cookie']
        .find((cookie: string) => cookie.startsWith('auth_token='));
      expect(authCookie).toBeDefined();
      expect(authCookie).toMatch(/HttpOnly/);
      expect(authCookie).toMatch(/Secure/);
      expect(authCookie).toMatch(/SameSite=Strict/);

      // Verify response body
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(TEST_USER.email);
      expect(response.body.sessionId).toBeDefined();
    });

    it('should reject callback with invalid CSRF token', async () => {
      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid_auth_code',
          state: 'invalid_state'
        })
        .set('Cookie', ['csrf_token=invalid_token'])
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

      expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
    });

    it('should handle concurrent session limits', async () => {
      // Setup multiple valid sessions
      const sessions = await Promise.all(Array(3).fill(null).map(async () => {
        const response = await agent
          .get('/api/v1/auth/google/callback')
          .query({
            code: 'valid_auth_code',
            state: Buffer.from(JSON.stringify({
              csrfToken: uuidv4(),
              timestamp: Date.now()
            })).toString('base64')
          })
          .expect(HTTP_STATUS_CODES.OK);

        return response.body.sessionId;
      }));

      expect(sessions.length).toBe(3);

      // Attempt to create another session
      const response = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid_auth_code',
          state: Buffer.from(JSON.stringify({
            csrfToken: uuidv4(),
            timestamp: Date.now()
          })).toString('base64')
        })
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

      expect(response.body.code).toBe(AUTH_ERRORS.AUTH005);
    });
  });

  describe('Session Management', () => {
    it('should handle session refresh with sliding expiration', async () => {
      // Create initial session
      const initialResponse = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid_auth_code',
          state: Buffer.from(JSON.stringify({
            csrfToken: uuidv4(),
            timestamp: Date.now()
          })).toString('base64')
        })
        .expect(HTTP_STATUS_CODES.OK);

      const initialToken = initialResponse.headers['set-cookie']
        .find((cookie: string) => cookie.startsWith('auth_token='));

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh session
      const refreshResponse = await agent
        .post('/api/v1/auth/refresh')
        .set('Cookie', [initialToken])
        .expect(HTTP_STATUS_CODES.OK);

      // Verify new token
      expect(refreshResponse.headers['set-cookie']).toBeDefined();
      const newToken = refreshResponse.headers['set-cookie']
        .find((cookie: string) => cookie.startsWith('auth_token='));
      expect(newToken).not.toBe(initialToken);
    });

    it('should properly invalidate session on logout', async () => {
      // Create session
      const loginResponse = await agent
        .get('/api/v1/auth/google/callback')
        .query({
          code: 'valid_auth_code',
          state: Buffer.from(JSON.stringify({
            csrfToken: uuidv4(),
            timestamp: Date.now()
          })).toString('base64')
        })
        .expect(HTTP_STATUS_CODES.OK);

      const authToken = loginResponse.headers['set-cookie']
        .find((cookie: string) => cookie.startsWith('auth_token='));

      // Logout
      await agent
        .post('/api/v1/auth/logout')
        .set('Cookie', [authToken])
        .expect(HTTP_STATUS_CODES.NO_CONTENT);

      // Verify session is invalidated
      await agent
        .get('/api/v1/auth/validate')
        .set('Cookie', [authToken])
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);
    });
  });

  describe('Security Headers', () => {
    it('should set appropriate security headers on all responses', async () => {
      const response = await agent
        .get('/api/v1/auth/google')
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});