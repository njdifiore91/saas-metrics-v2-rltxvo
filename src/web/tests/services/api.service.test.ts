import { apiService } from '../../src/services/api.service';
import { ApiResponse } from '../../src/types/api.types';
import { API_ENDPOINTS, ERROR_CODES } from '../../src/constants/api.constants';
import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import axios from 'axios'; // ^1.4.0
import 'mock-local-storage'; // ^1.1.0

describe('ApiService', () => {
  let axiosMock: MockAdapter;

  beforeEach(() => {
    // Initialize axios mock adapter
    axiosMock = new MockAdapter(axios);
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset cache
    apiService.clearCache();
  });

  afterEach(() => {
    axiosMock.reset();
    jest.clearAllMocks();
  });

  describe('HTTP Methods', () => {
    const testEndpoint = API_ENDPOINTS.METRICS.LIST;
    const testData = { id: '1', name: 'Test Metric' };
    const testResponse: ApiResponse<typeof testData> = {
      data: testData,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        requestId: '123'
      }
    };

    test('should make successful GET request with proper response transformation', async () => {
      axiosMock.onGet(testEndpoint).reply(200, testResponse);

      const response = await apiService.get(testEndpoint);
      expect(response).toEqual(testResponse);
      expect(response.data).toBeDefined();
      expect(response.meta).toBeDefined();
    });

    test('should handle GET request with query parameters and caching', async () => {
      const params = { filter: 'active' };
      axiosMock.onGet(testEndpoint, { params }).reply(200, testResponse);

      // First request - should hit API
      const response1 = await apiService.get(testEndpoint, params, { cache: true });
      
      // Second request - should hit cache
      const response2 = await apiService.get(testEndpoint, params, { cache: true });

      expect(response1).toEqual(response2);
      expect(axiosMock.history.get.length).toBe(1);
    });

    test('should make POST request with correct content-type and body', async () => {
      axiosMock.onPost(testEndpoint, testData).reply(201, testResponse);

      const response = await apiService.post(testEndpoint, testData);
      
      expect(response).toEqual(testResponse);
      expect(axiosMock.history.post[0].headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(axiosMock.history.post[0].data)).toEqual(testData);
    });

    test('should handle PUT request with proper data transformation', async () => {
      const updateEndpoint = API_ENDPOINTS.METRICS.UPDATE.replace(':id', '1');
      axiosMock.onPut(updateEndpoint, testData).reply(200, testResponse);

      const response = await apiService.put(updateEndpoint, testData);
      
      expect(response).toEqual(testResponse);
      expect(axiosMock.history.put[0].data).toBeDefined();
    });

    test('should process DELETE request with proper authorization', async () => {
      const deleteEndpoint = API_ENDPOINTS.METRICS.DELETE.replace(':id', '1');
      const token = 'test-token';
      localStorage.setItem('authToken', token);

      axiosMock.onDelete(deleteEndpoint).reply(200, testResponse);

      const response = await apiService.delete(deleteEndpoint);
      
      expect(response).toEqual(testResponse);
      expect(axiosMock.history.delete[0].headers['Authorization']).toBe(`Bearer ${token}`);
    });
  });

  describe('Error Handling', () => {
    test('should handle network timeouts with retry mechanism', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      
      // Simulate timeout twice, then succeed
      axiosMock
        .onGet(testEndpoint)
        .timeoutOnce()
        .timeoutOnce()
        .reply(200, { data: 'success' });

      const response = await apiService.get(testEndpoint);
      expect(response.data).toBe('success');
      expect(axiosMock.history.get.length).toBe(3);
    });

    test('should implement exponential backoff for rate limiting', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const retryAfter = 1;

      axiosMock
        .onGet(testEndpoint)
        .reply(429, { error: 'Rate limited' }, { 'Retry-After': retryAfter.toString() });

      const startTime = Date.now();
      try {
        await apiService.get(testEndpoint);
      } catch (error: any) {
        expect(error.code).toBe(ERROR_CODES.SYS.RATE_LIMIT);
        expect(Date.now() - startTime).toBeGreaterThanOrEqual(retryAfter * 1000);
      }
    });

    test('should transform API errors to standard format', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const errorResponse = {
        code: ERROR_CODES.DATA.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { field: 'name', error: 'Required' }
      };

      axiosMock.onGet(testEndpoint).reply(400, errorResponse);

      try {
        await apiService.get(testEndpoint);
      } catch (error: any) {
        expect(error.code).toBe(ERROR_CODES.DATA.VALIDATION_ERROR);
        expect(error.message).toBe('Validation failed');
        expect(error.details).toBeDefined();
      }
    });

    test('should handle authentication errors with token refresh', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const refreshToken = 'refresh-token';
      const newToken = 'new-token';
      
      localStorage.setItem('refreshToken', refreshToken);

      // Initial request fails with 401
      axiosMock.onGet(testEndpoint).replyOnce(401);
      
      // Token refresh succeeds
      axiosMock.onPost(API_ENDPOINTS.AUTH.REFRESH).reply(200, { token: newToken });
      
      // Retry original request succeeds
      axiosMock.onGet(testEndpoint).reply(200, { data: 'success' });

      const response = await apiService.get(testEndpoint);
      
      expect(response.data).toBe('success');
      expect(localStorage.getItem('authToken')).toBe(newToken);
    });
  });

  describe('Caching', () => {
    test('should cache GET requests according to cache-control', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const testResponse = { data: 'cached' };

      axiosMock.onGet(testEndpoint).reply(200, testResponse);

      // First request
      await apiService.get(testEndpoint, {}, { cache: true });
      
      // Second request should use cache
      const cachedResponse = await apiService.get(testEndpoint, {}, { cache: true });
      
      expect(cachedResponse.data).toBe('cached');
      expect(axiosMock.history.get.length).toBe(1);
    });

    test('should invalidate cache on POST/PUT/DELETE', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const getData = { data: 'test' };
      const postData = { name: 'new' };

      // Setup GET cache
      axiosMock.onGet(testEndpoint).reply(200, getData);
      await apiService.get(testEndpoint, {}, { cache: true });

      // POST request should invalidate cache
      axiosMock.onPost(testEndpoint).reply(201, postData);
      await apiService.post(testEndpoint, postData);

      // Subsequent GET should hit API
      axiosMock.onGet(testEndpoint).reply(200, getData);
      await apiService.get(testEndpoint, {}, { cache: true });

      expect(axiosMock.history.get.length).toBe(2);
    });
  });

  describe('Security', () => {
    test('should include all required security headers', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      axiosMock.onGet(testEndpoint).reply(200, { data: 'test' });

      await apiService.get(testEndpoint);

      const headers = axiosMock.history.get[0].headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    test('should handle token refresh flow securely', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const refreshToken = 'refresh-token';
      
      localStorage.setItem('refreshToken', refreshToken);
      
      // Simulate token refresh failure
      axiosMock.onGet(testEndpoint).reply(401);
      axiosMock.onPost(API_ENDPOINTS.AUTH.REFRESH).networkError();

      try {
        await apiService.get(testEndpoint);
      } catch (error) {
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
      }
    });

    test('should sanitize error responses', async () => {
      const testEndpoint = API_ENDPOINTS.METRICS.LIST;
      const sensitiveError = {
        code: 'ERROR',
        message: 'Error occurred',
        stack: 'Sensitive stack trace',
        serverDetails: 'Internal server info'
      };

      axiosMock.onGet(testEndpoint).reply(500, sensitiveError);

      try {
        await apiService.get(testEndpoint);
      } catch (error: any) {
        expect(error.stack).toBeUndefined();
        expect(error.serverDetails).toBeUndefined();
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });
  });
});