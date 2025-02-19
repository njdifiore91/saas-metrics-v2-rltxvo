/**
 * API Configuration
 * Centralizes API configuration settings for the frontend application including
 * security, request handling, retry policies, and error management.
 * @version 1.0.0
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'; // ^1.4.0
import { API_ENDPOINTS } from '../constants/api.constants';

// Environment-based configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_VERSION = 'v1';
const API_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

/**
 * Security headers configuration following OWASP recommendations
 */
const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

/**
 * Retry policy configuration for failed requests
 */
const RETRY_POLICY = {
  maxRetries: MAX_RETRIES,
  initialRetryDelay: INITIAL_RETRY_DELAY,
  maxRetryDelay: 10000,
  retryConditions: ['5XX', '429', 'Network Error'],
  backoffFactor: 2,
  shouldRetry: (error: AxiosError) => {
    const status = error.response?.status;
    return (
      (status && status >= 500) ||
      status === 429 ||
      error.message === 'Network Error'
    );
  }
};

/**
 * Error handling configuration
 */
const ERROR_HANDLING = {
  timeoutError: `Request timeout after ${API_TIMEOUT / 1000} seconds`,
  networkError: 'Network connection error. Please check your internet connection',
  serverError: 'Internal server error. Please try again later',
  rateLimitError: 'Rate limit exceeded. Please wait before trying again',
  authenticationError: 'Authentication failed. Please log in again',
  validationError: 'Invalid request data. Please check your input',
  errorLogging: {
    enabled: true,
    level: 'error',
    includeStack: true
  }
};

/**
 * Creates request interceptor for authentication and request tracking
 */
const createRequestInterceptor = (config: AxiosRequestConfig) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Add request tracking headers
  config.headers = {
    ...config.headers,
    'X-Request-ID': crypto.randomUUID(),
    'X-Request-Timestamp': new Date().toISOString()
  };

  return config;
};

/**
 * Creates response interceptor for error handling and response processing
 */
const createResponseInterceptor = {
  success: (response: AxiosResponse) => {
    return response.data;
  },
  error: async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle token refresh
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(API_ENDPOINTS.AUTH.REFRESH, {
            refreshToken
          });
          localStorage.setItem('authToken', response.data.token);
          return axios(error.config!);
        } catch (refreshError) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(axios(error.config!));
        }, (parseInt(retryAfter) || 30) * 1000);
      });
    }

    throw {
      status: error.response?.status,
      code: error.response?.data?.code,
      message: error.response?.data?.message || ERROR_HANDLING.serverError
    };
  }
};

/**
 * Main API configuration object
 */
export const apiConfig = {
  baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: SECURITY_HEADERS,
  retryPolicy: RETRY_POLICY,
  withCredentials: true,

  // Request/Response interceptors
  interceptors: {
    request: createRequestInterceptor,
    response: createResponseInterceptor
  },

  // Error handling configuration
  errorHandler: ERROR_HANDLING,

  // Response format configuration
  responseType: 'json',
  validateStatus: (status: number) => {
    return status >= 200 && status < 300;
  },

  // Rate limiting configuration
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    perWindow: 60000, // 1 minute
    headerLimit: 'X-RateLimit-Limit',
    headerRemaining: 'X-RateLimit-Remaining',
    headerReset: 'X-RateLimit-Reset'
  }
};

/**
 * Create axios instance with configuration
 */
const axiosInstance = axios.create(apiConfig);

// Apply interceptors
axiosInstance.interceptors.request.use(
  apiConfig.interceptors.request,
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  apiConfig.interceptors.response.success,
  apiConfig.interceptors.response.error
);

export default axiosInstance;