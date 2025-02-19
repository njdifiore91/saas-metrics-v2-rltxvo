/**
 * Core TypeScript types and interfaces for API communication
 * Defines standardized structures for requests, responses, and error handling
 * @version 1.0.0
 */

/**
 * Generic interface for standardized API responses
 * Follows JSON:API specification pattern for consistent response handling
 */
export interface ApiResponse<T> {
  data: T;
  meta: ApiMetadata;
}

/**
 * Interface defining metadata structure for API responses
 * Includes timing, versioning, and request tracking information
 */
export interface ApiMetadata {
  timestamp: string;  // ISO8601 formatted timestamp
  version: string;    // API version identifier
  requestId: string;  // Unique request identifier for tracing
}

/**
 * Comprehensive interface for error responses
 * Follows RFC 7807 Problem Details for HTTP APIs specification
 */
export interface ApiError {
  code: string;                        // Error code identifier
  message: string;                     // Human-readable error message
  details?: Record<string, unknown>;   // Additional error context
  stack?: string;                      // Stack trace (development only)
}

/**
 * Enum defining available user roles for role-based access control
 * Maps to authorization levels defined in technical specifications
 */
export enum UserRole {
  ADMIN = 'ADMIN',       // Full system access
  ANALYST = 'ANALYST',   // High-level access with data management
  USER = 'USER',         // Limited access for basic operations
  GUEST = 'GUEST'        // Minimal access for public data only
}

/**
 * Enum defining supported HTTP methods for API requests
 * Standardizes method types across the application
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * Comprehensive interface for configuring API requests
 * Includes all necessary options for making HTTP requests
 */
export interface ApiRequestConfig {
  url: string;                           // Request URL
  method: HttpMethod;                    // HTTP method
  params?: Record<string, unknown>;      // URL parameters
  data?: unknown;                        // Request body
  headers?: Record<string, string>;      // Custom headers
  timeout?: number;                      // Request timeout in milliseconds
  withCredentials?: boolean;             // Include credentials for CORS
}