/**
 * Core API service for handling all HTTP communications with backend services
 * Implements standardized request handling, caching, retry logic, and error management
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import { apiConfig } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { ApiResponse, ApiError, ApiRequestConfig } from '../types/api.types';

/**
 * Interface for request options including cache configuration
 */
interface RequestOptions {
  cache?: boolean;
  cacheDuration?: number;
  retry?: boolean;
  timeout?: number;
}

/**
 * Default cache duration in milliseconds (15 minutes)
 */
const DEFAULT_CACHE_DURATION = 15 * 60 * 1000;

class ApiService {
  private axios: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;
  private baseURL: string;

  constructor() {
    this.baseURL = apiConfig.baseURL;
    this.cache = new Map();
    
    // Initialize axios instance with config
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: apiConfig.timeout,
      headers: apiConfig.headers,
      withCredentials: true
    });

    // Configure retry mechanism
    axiosRetry(this.axios, {
      retries: apiConfig.retryPolicy.maxRetries,
      retryDelay: (retryCount) => {
        return Math.min(
          apiConfig.retryPolicy.initialRetryDelay * Math.pow(2, retryCount - 1),
          apiConfig.retryPolicy.maxRetryDelay
        );
      },
      retryCondition: (error: AxiosError) => {
        return apiConfig.retryPolicy.shouldRetry(error);
      }
    });

    // Setup request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Setup response interceptor
    this.axios.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          return this.handleTokenRefresh(error);
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Performs GET request with caching support
   */
  public async get<T>(
    url: string,
    params?: Record<string, any>,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey(url, params);
    const cachedResponse = this.getFromCache(cacheKey);

    if (options.cache !== false && cachedResponse) {
      return cachedResponse;
    }

    try {
      const response = await this.axios.get<ApiResponse<T>>(url, { params });
      
      if (options.cache !== false) {
        this.setCache(cacheKey, response, options.cacheDuration);
      }

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Performs POST request
   */
  public async post<T>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.post<ApiResponse<T>>(url, data, {
        timeout: options.timeout || apiConfig.timeout
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Performs PUT request
   */
  public async put<T>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.put<ApiResponse<T>>(url, data, {
        timeout: options.timeout || apiConfig.timeout
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Performs DELETE request
   */
  public async delete<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.delete<ApiResponse<T>>(url, {
        timeout: options.timeout || apiConfig.timeout
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handles token refresh when authentication expires
   */
  private async handleTokenRefresh(error: AxiosError): Promise<any> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.axios.post(API_ENDPOINTS.AUTH.REFRESH, {
        refreshToken
      });

      localStorage.setItem('authToken', response.data.token);
      
      // Retry the original request
      const config = error.config as AxiosRequestConfig;
      if (config.headers) {
        config.headers.Authorization = `Bearer ${response.data.token}`;
      }
      return this.axios(config);
    } catch (refreshError) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw refreshError;
    }
  }

  /**
   * Standardized error handling
   */
  private handleError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      return {
        code: response?.data?.code || 'UNKNOWN_ERROR',
        message: response?.data?.message || 'An unexpected error occurred',
        details: response?.data?.details || {},
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: {},
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  /**
   * Generates cache key for GET requests
   */
  private getCacheKey(url: string, params?: Record<string, any>): string {
    return `${url}${params ? `?${JSON.stringify(params)}` : ''}`;
  }

  /**
   * Retrieves cached response if valid
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > DEFAULT_CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Caches response data with timestamp
   */
  private setCache(
    key: string,
    data: any,
    duration: number = DEFAULT_CACHE_DURATION
  ): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Set cache expiration
    setTimeout(() => {
      this.cache.delete(key);
    }, duration);
  }
}

// Export singleton instance
export const apiService = new ApiService();