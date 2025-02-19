import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'jest';
import { SuperTest } from 'supertest';
import { faker } from '@faker-js/faker';
import nock from 'nock';

import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { generateTestToken } from '../../utils/jwt-helpers';
import { HTTP_STATUS_CODES, AUTH_ERRORS, DATA_ERRORS, SYSTEM_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { UserRole } from '../../../backend/src/shared/interfaces/user.interface';
import { MetricType, MetricTimeframe } from '../../../backend/src/shared/types/metric-types';

describe('API Gateway Request Routing', () => {
  let testAgent: SuperTest<any>;
  let validUserToken: string;
  let adminToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    await setupTestServer({
      enableSecurity: true,
      enableCompression: true,
      enableRateLimit: true,
      timeoutMs: 5000
    });

    // Generate test tokens
    validUserToken = generateTestToken({
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      role: UserRole.USER,
      permissions: ['read', 'write']
    });

    adminToken = generateTestToken({
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      role: UserRole.ADMIN,
      permissions: ['read', 'write', 'delete', 'manage']
    });

    expiredToken = generateTestToken({
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      role: UserRole.USER,
      expiresIn: '-1h'
    });

    testAgent = getTestAgent({
      retryCount: 0,
      timeout: 5000
    });
  });

  afterAll(async () => {
    await teardownTestServer();
    nock.cleanAll();
  });

  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Authentication Routes', () => {
    it('should route /auth/login to auth service with correct headers', async () => {
      const mockResponse = { token: 'test-token' };
      
      nock('http://localhost:3001')
        .post('/auth/login')
        .reply(200, mockResponse);

      const response = await testAgent
        .post('/api/v1/auth/login')
        .send({ email: faker.internet.email(), password: 'test123' })
        .expect('Content-Type', /json/)
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.body).toEqual(mockResponse);
    });

    it('should route /auth/google to Google OAuth handler with state parameter', async () => {
      const response = await testAgent
        .get('/api/v1/auth/google')
        .expect(HTTP_STATUS_CODES.FOUND);

      expect(response.header.location).toContain('accounts.google.com');
      expect(response.header.location).toContain('state=');
    });

    it('should return 401 for invalid tokens with proper error format', async () => {
      const response = await testAgent
        .get('/api/v1/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

      expect(response.body).toMatchObject({
        type: 'https://api.startup-metrics.com/errors/auth-failed',
        status: HTTP_STATUS_CODES.UNAUTHORIZED,
        code: AUTH_ERRORS.AUTH003
      });
    });

    it('should handle token expiration and refresh flow correctly', async () => {
      const response = await testAgent
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

      expect(response.body.code).toBe(AUTH_ERRORS.AUTH001);
    });
  });

  describe('Metrics Routes', () => {
    it('should route /metrics requests to metrics service with authentication', async () => {
      nock('http://localhost:3002')
        .get('/metrics')
        .reply(200, { metrics: [] });

      const response = await testAgent
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${validUserToken}`)
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.body).toHaveProperty('metrics');
    });

    it('should validate metric request payload schema', async () => {
      const invalidPayload = {
        value: 'not-a-number',
        metricId: 'invalid-uuid'
      };

      const response = await testAgent
        .post('/api/v1/metrics')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send(invalidPayload)
        .expect(HTTP_STATUS_CODES.BAD_REQUEST);

      expect(response.body.code).toBe(DATA_ERRORS.DATA003);
    });

    it('should enforce role-based access on sensitive metrics', async () => {
      const response = await testAgent
        .delete('/api/v1/metrics/test-id')
        .set('Authorization', `Bearer ${validUserToken}`)
        .expect(HTTP_STATUS_CODES.FORBIDDEN);

      expect(response.body.code).toBe(AUTH_ERRORS.AUTH002);
    });

    it('should maintain sub-200ms response times under load', async () => {
      const requests = Array(10).fill(null).map(() => 
        testAgent
          .get('/api/v1/metrics')
          .set('Authorization', `Bearer ${validUserToken}`)
      );

      const startTime = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(duration / 10).toBeLessThan(200);
    });
  });

  describe('Benchmark Routes', () => {
    it('should route /benchmarks requests with proper authorization', async () => {
      nock('http://localhost:3003')
        .get('/benchmarks')
        .reply(200, { benchmarks: [] });

      const response = await testAgent
        .get('/api/v1/benchmarks')
        .set('Authorization', `Bearer ${validUserToken}`)
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.body).toHaveProperty('benchmarks');
    });

    it('should validate benchmark parameters and ranges', async () => {
      const invalidParams = {
        metricType: 'INVALID_TYPE',
        revenueRange: 'invalid-range'
      };

      const response = await testAgent
        .post('/api/v1/benchmarks/compare')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send(invalidParams)
        .expect(HTTP_STATUS_CODES.BAD_REQUEST);

      expect(response.body.code).toBe(DATA_ERRORS.DATA003);
    });

    it('should handle concurrent benchmark comparison requests', async () => {
      const validPayload = {
        metricType: MetricType.FINANCIAL,
        timeframe: MetricTimeframe.QUARTERLY,
        value: 100
      };

      const requests = Array(5).fill(null).map(() =>
        testAgent
          .post('/api/v1/benchmarks/compare')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send(validPayload)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS_CODES.OK);
      });
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers in responses', async () => {
      const response = await testAgent
        .get('/api/v1/health')
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'content-security-policy': expect.any(String)
      });
    });

    it('should enforce CORS policies correctly', async () => {
      const response = await testAgent
        .options('/api/v1/metrics')
        .set('Origin', 'http://localhost:5173')
        .expect(HTTP_STATUS_CODES.NO_CONTENT);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('Error Handling', () => {
    it('should return RFC 7807 compliant error responses', async () => {
      const response = await testAgent
        .get('/api/v1/invalid-endpoint')
        .expect(HTTP_STATUS_CODES.NOT_FOUND);

      expect(response.body).toMatchObject({
        type: expect.any(String),
        status: HTTP_STATUS_CODES.NOT_FOUND,
        code: 'API002',
        message: expect.any(String),
        instance: expect.any(String)
      });
    });

    it('should handle service timeouts gracefully', async () => {
      nock('http://localhost:3002')
        .get('/metrics')
        .delay(6000)
        .reply(200);

      const response = await testAgent
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${validUserToken}`)
        .expect(HTTP_STATUS_CODES.SERVER_ERROR);

      expect(response.body.code).toBe(SYSTEM_ERRORS.SYS002);
    });
  });

  describe('Performance', () => {
    it('should handle 100 concurrent requests efficiently', async () => {
      const requests = Array(100).fill(null).map(() =>
        testAgent
          .get('/api/v1/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS_CODES.OK);
      });
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain performance with rate limiting enabled', async () => {
      const requests = Array(50).fill(null).map(() =>
        testAgent
          .get('/api/v1/metrics')
          .set('Authorization', `Bearer ${validUserToken}`)
      );

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter(r => r.status === HTTP_STATUS_CODES.OK);
      const rateLimitedResponses = responses.filter(r => r.status === HTTP_STATUS_CODES.RATE_LIMIT);

      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});