import { describe, it, beforeAll, afterAll, expect } from 'jest';
import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { generateTestToken, generateExpiredToken, decodeTestToken } from '../../utils/jwt-helpers';
import { AUTH_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('JWT Authentication Flow', () => {
  // Initialize test server and agent
  beforeAll(async () => {
    await setupTestServer({
      enableSecurity: true,
      enableRateLimit: true,
      timeoutMs: 5000
    });
  });

  // Cleanup after tests
  afterAll(async () => {
    await teardownTestServer();
  });

  it('should validate a valid JWT token', async () => {
    // Generate valid test token
    const testToken = generateTestToken({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@company.com',
      role: 'user',
      permissions: ['read', 'write']
    });

    // Make authenticated request
    const response = await getTestAgent()
      .get('/api/v1/auth/validate')
      .set('Authorization', `Bearer ${testToken}`)
      .set('X-Correlation-ID', `test-${Date.now()}`);

    // Verify response
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data.userId');
    expect(response.body).toHaveProperty('data.sessionId');

    // Verify security headers
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    expect(response.headers).toHaveProperty('content-security-policy');

    // Verify session extension
    expect(response.headers).toHaveProperty('x-refresh-token');
    const refreshToken = response.headers['x-refresh-token'];
    const decodedRefresh = decodeTestToken(refreshToken);
    expect(decodedRefresh).toHaveProperty('exp');
  });

  it('should reject an expired JWT token', async () => {
    // Generate expired test token
    const expiredToken = generateExpiredToken({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@company.com'
    });

    // Make request with expired token
    const response = await getTestAgent()
      .get('/api/v1/auth/validate')
      .set('Authorization', `Bearer ${expiredToken}`)
      .set('X-Correlation-ID', `test-${Date.now()}`);

    // Verify error response follows RFC 7807
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      type: 'https://api.startup-metrics.com/errors/auth-failed',
      status: 401,
      code: AUTH_ERRORS.AUTH001,
      message: 'OAuth token expired or invalid',
      details: expect.any(Object),
      instance: expect.any(String)
    });

    // Verify security headers
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
  });

  it('should reject a malformed JWT token', async () => {
    // Test various malformed token scenarios
    const malformedTokens = [
      'invalid.token.format',
      'invalid-token',
      'Bearer invalid-token',
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.invalid'
    ];

    for (const token of malformedTokens) {
      const response = await getTestAgent()
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Correlation-ID', `test-${Date.now()}`);

      // Verify error response
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        type: 'https://api.startup-metrics.com/errors/auth-failed',
        status: 401,
        code: AUTH_ERRORS.AUTH003,
        message: 'Invalid authentication credentials',
        details: expect.any(Object),
        instance: expect.any(String)
      });

      // Verify security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    }
  });

  it('should reject requests without a JWT token', async () => {
    // Make request without token
    const response = await getTestAgent()
      .get('/api/v1/auth/validate')
      .set('X-Correlation-ID', `test-${Date.now()}`);

    // Verify error response
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      type: 'https://api.startup-metrics.com/errors/auth-failed',
      status: 401,
      code: AUTH_ERRORS.AUTH002,
      message: 'Insufficient permissions for requested operation',
      details: expect.any(Object),
      instance: expect.any(String)
    });

    // Verify security headers
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
  });

  it('should enforce concurrent session limits', async () => {
    // Generate multiple tokens for same user
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const tokens = Array.from({ length: 4 }, () => generateTestToken({
      userId,
      email: 'test@company.com',
      role: 'user'
    }));

    // Make concurrent requests
    const responses = await Promise.all(tokens.map(token => 
      getTestAgent()
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Correlation-ID', `test-${Date.now()}`)
    ));

    // Verify session limit enforcement (max 3 sessions)
    const validSessions = responses.filter(r => r.status === 200);
    const rejectedSessions = responses.filter(r => r.status === 401);

    expect(validSessions.length).toBeLessThanOrEqual(3);
    expect(rejectedSessions.length).toBeGreaterThan(0);

    // Verify rejection response
    const rejection = rejectedSessions[0];
    expect(rejection.body).toMatchObject({
      type: 'https://api.startup-metrics.com/errors/auth-failed',
      status: 401,
      code: AUTH_ERRORS.AUTH005,
      message: 'Maximum concurrent sessions exceeded',
      details: expect.any(Object),
      instance: expect.any(String)
    });
  });
});