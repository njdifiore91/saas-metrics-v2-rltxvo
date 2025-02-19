import { describe, test, beforeAll, afterAll, beforeEach, expect } from 'jest';
import supertest from 'supertest';
import { setupTestServer, teardownTestServer, getTestAgent } from '../utils/test-server';
import { HTTP_STATUS_CODES, AUTH_ERRORS, DATA_ERRORS } from '../../backend/src/shared/constants/error-codes';

let testAgent: supertest.SuperTest<supertest.Test>;

// Test suite setup and teardown
beforeAll(async () => {
  await setupTestServer({
    enableSecurity: true,
    enableRateLimit: true,
    timeoutMs: 5000
  });
});

afterAll(async () => {
  await teardownTestServer();
});

beforeEach(async () => {
  testAgent = getTestAgent({
    retryCount: 0,
    timeout: 5000
  });
});

describe('API Security Headers', () => {
  test('should enforce required security headers on all responses', async () => {
    const response = await testAgent.get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('should not expose sensitive headers in responses', async () => {
    const response = await testAgent.get('/api/v1/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['server']).toBeUndefined();
  });
});

describe('Authentication Bypass Tests', () => {
  test('should reject requests without authentication token', async () => {
    const response = await testAgent
      .get('/api/v1/metrics')
      .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

    expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
  });

  test('should reject requests with invalid JWT format', async () => {
    const response = await testAgent
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

    expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
  });

  test('should reject requests with expired tokens', async () => {
    const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.NHVaYe26MbtOYhSKkoKYdFVomg4i8ZJd8_-RU8VNbftc4TSMb4bXP3l3YlNWACwyXPGffz5aXHc6lty1Y2t4SWRqGteragsVdZufDn5BlnJl9pdR_kdVFUsra2rWKEofkZeIC4yWytE58sMIihvo9H1ScmmVwBcQP6XETqYd0aSHp1gOa9RdUPDvoXQ5oqygTqVtxaDr6wUFKrKItgBMzWIdNZ6y7O9E0DhEPTbE9rfBo6KTFsHAZnMg4k68CDp2woYIaXbmYTWcvbzIuHO7_37GT79XdIwkm95QJ7hYC9RiwrV7mesbY4PAahERJawntho0my3RqzqSR8HhyF-9Qw';
    
    const response = await testAgent
      .get('/api/v1/metrics')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

    expect(response.body.code).toBe(AUTH_ERRORS.AUTH001);
  });

  test('should reject tokens with invalid signatures', async () => {
    const tamperedToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.tampered-signature';
    
    const response = await testAgent
      .get('/api/v1/metrics')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

    expect(response.body.code).toBe(AUTH_ERRORS.AUTH003);
  });
});

describe('Rate Limiting Tests', () => {
  test('should enforce rate limits on API endpoints', async () => {
    const requests = Array(101).fill(null).map(() => 
      testAgent.get('/api/v1/metrics')
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponse = responses[responses.length - 1];

    expect(rateLimitedResponse.status).toBe(HTTP_STATUS_CODES.RATE_LIMIT);
    expect(rateLimitedResponse.body.code).toBe('SYS001');
    expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
  });

  test('should include rate limit headers in responses', async () => {
    const response = await testAgent.get('/api/v1/metrics');

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });
});

describe('SQL Injection Tests', () => {
  test('should sanitize query parameters against SQL injection', async () => {
    const maliciousQuery = "1' OR '1'='1";
    
    const response = await testAgent
      .get(`/api/v1/metrics?id=${maliciousQuery}`)
      .expect(HTTP_STATUS_CODES.BAD_REQUEST);

    expect(response.body.code).toBe(DATA_ERRORS.DATA003);
  });

  test('should prevent SQL injection in request body', async () => {
    const maliciousBody = {
      query: "'; DROP TABLE users; --"
    };

    const response = await testAgent
      .post('/api/v1/metrics/search')
      .send(maliciousBody)
      .expect(HTTP_STATUS_CODES.BAD_REQUEST);

    expect(response.body.code).toBe(DATA_ERRORS.DATA003);
  });
});

describe('XSS Vulnerability Tests', () => {
  test('should sanitize input to prevent stored XSS', async () => {
    const xssPayload = {
      name: '<script>alert("XSS")</script>Metric Name'
    };

    const response = await testAgent
      .post('/api/v1/metrics')
      .send(xssPayload)
      .expect(HTTP_STATUS_CODES.BAD_REQUEST);

    expect(response.body.code).toBe(DATA_ERRORS.DATA003);
  });

  test('should encode output to prevent reflected XSS', async () => {
    const xssQuery = '<script>alert("XSS")</script>';
    
    const response = await testAgent
      .get(`/api/v1/metrics/search?q=${xssQuery}`);

    expect(response.text).not.toContain('<script>');
    expect(response.headers['content-type']).toContain('application/json');
  });

  test('should set CSP headers to prevent XSS attacks', async () => {
    const response = await testAgent.get('/api/v1/metrics');

    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});