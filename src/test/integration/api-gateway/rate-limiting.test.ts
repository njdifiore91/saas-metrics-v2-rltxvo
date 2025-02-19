import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { rateLimitConfig } from '../../../../backend/src/api-gateway/src/config/rate-limit.config';
import { SYSTEM_ERRORS, HTTP_STATUS_CODES } from '../../../../backend/src/shared/constants/error-codes';
import supertest from 'supertest'; // v6.3.3
import jest from 'jest'; // v29.0.0

describe('API Gateway Rate Limiting', () => {
  let testAgent: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    await setupTestServer({
      enableRateLimit: true,
      enableSecurity: true
    });
    testAgent = getTestAgent();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  beforeEach(async () => {
    // Reset rate limit counters in Redis store
    if (rateLimitConfig.store) {
      await rateLimitConfig.store.resetAll();
    }
  });

  afterEach(async () => {
    // Clear rate limit data
    if (rateLimitConfig.store) {
      await rateLimitConfig.store.resetAll();
    }
  });

  /**
   * Helper function to make multiple concurrent API requests
   */
  const makeRequests = async (
    count: number,
    endpoint: string,
    clientId: string
  ): Promise<supertest.Response[]> => {
    const requests = Array.from({ length: count }, () =>
      testAgent
        .get(endpoint)
        .set('X-Client-ID', clientId)
        .set('Accept', 'application/json')
    );
    return Promise.all(requests);
  };

  describe('Rate Limit Enforcement', () => {
    it('should allow requests within rate limit', async () => {
      const clientId = 'test-client-1';
      const responses = await makeRequests(
        rateLimitConfig.max - 1,
        '/api/v1/health',
        clientId
      );

      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS_CODES.OK);
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThan(0);
      });
    });

    it('should block requests exceeding rate limit', async () => {
      const clientId = 'test-client-2';
      const totalRequests = rateLimitConfig.max + 20;
      const responses = await makeRequests(
        totalRequests,
        '/api/v1/health',
        clientId
      );

      const successfulResponses = responses.filter(r => r.status === HTTP_STATUS_CODES.OK);
      const blockedResponses = responses.filter(r => r.status === HTTP_STATUS_CODES.RATE_LIMIT);

      expect(successfulResponses.length).toBe(rateLimitConfig.max);
      expect(blockedResponses.length).toBe(totalRequests - rateLimitConfig.max);

      // Verify RFC 7807 error response format
      blockedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          type: 'https://api.startup-metrics.com/errors/rate-limit',
          status: HTTP_STATUS_CODES.RATE_LIMIT,
          code: SYSTEM_ERRORS.SYS001,
          message: expect.any(String),
          details: {
            limit: rateLimitConfig.max,
            windowMs: rateLimitConfig.windowMs,
            retryAfter: expect.any(Number)
          }
        });
        expect(response.headers['retry-after']).toBeDefined();
      });
    });

    it('should reset rate limit after window expires', async () => {
      const clientId = 'test-client-3';
      
      // Make requests up to limit
      const initialResponses = await makeRequests(
        rateLimitConfig.max,
        '/api/v1/health',
        clientId
      );
      expect(initialResponses.every(r => r.status === HTTP_STATUS_CODES.OK)).toBe(true);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, rateLimitConfig.windowMs + 1000));

      // Verify new requests are allowed
      const newResponses = await makeRequests(
        1,
        '/api/v1/health',
        clientId
      );
      expect(newResponses[0].status).toBe(HTTP_STATUS_CODES.OK);
      expect(parseInt(newResponses[0].headers['x-ratelimit-remaining'])).toBe(rateLimitConfig.max - 1);
    });

    it('should track limits separately per client', async () => {
      const client1 = 'test-client-4';
      const client2 = 'test-client-5';

      // Make requests for first client up to limit
      const client1Responses = await makeRequests(
        rateLimitConfig.max,
        '/api/v1/health',
        client1
      );
      expect(client1Responses.every(r => r.status === HTTP_STATUS_CODES.OK)).toBe(true);

      // Verify second client still has full limit
      const client2Response = await testAgent
        .get('/api/v1/health')
        .set('X-Client-ID', client2);
      
      expect(client2Response.status).toBe(HTTP_STATUS_CODES.OK);
      expect(parseInt(client2Response.headers['x-ratelimit-remaining'])).toBe(rateLimitConfig.max - 1);
    });

    it('should handle concurrent requests correctly', async () => {
      const clientId = 'test-client-6';
      const concurrentRequests = 50;

      // Make concurrent requests
      const responses = await Promise.all(
        Array.from({ length: concurrentRequests }, () =>
          testAgent
            .get('/api/v1/health')
            .set('X-Client-ID', clientId)
            .set('Accept', 'application/json')
        )
      );

      // Verify atomic counter updates
      const successCount = responses.filter(r => r.status === HTTP_STATUS_CODES.OK).length;
      const remainingValues = responses
        .filter(r => r.status === HTTP_STATUS_CODES.OK)
        .map(r => parseInt(r.headers['x-ratelimit-remaining']));

      expect(successCount).toBeLessThanOrEqual(rateLimitConfig.max);
      expect(new Set(remainingValues).size).toBe(successCount);
      expect(Math.max(...remainingValues)).toBe(rateLimitConfig.max - 1);
      expect(Math.min(...remainingValues)).toBe(rateLimitConfig.max - successCount);
    });
  });
});