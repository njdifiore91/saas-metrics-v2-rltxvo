/**
 * Authentication Service Validator
 * Provides validation schemas and functions for authentication-related requests
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.0.0
import { User, UserRole } from '../../shared/interfaces/user.interface';
import { AUTH_ERRORS } from '../../shared/constants/error-codes';

// Cache for compiled validation schemas
const SCHEMA_CACHE = new Map<string, Joi.ObjectSchema>();

// RFC 5322 compliant email pattern
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Validation result interface
interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Login request validation schema
 * Validates Google OAuth login parameters
 */
export const loginSchema = Joi.object({
  code: Joi.string()
    .required()
    .trim()
    .min(20)
    .max(1000)
    .pattern(/^[a-zA-Z0-9\-_]+$/)
    .messages({
      'string.empty': AUTH_ERRORS.AUTH001,
      'string.pattern.base': AUTH_ERRORS.AUTH001
    }),
  redirectUri: Joi.string()
    .uri()
    .trim()
    .max(2000)
    .optional()
    .messages({
      'string.uri': AUTH_ERRORS.AUTH001
    })
}).meta({ className: 'LoginRequest' });

/**
 * User data validation schema
 * Validates user profile data from Google OAuth
 */
export const userSchema = Joi.object({
  email: Joi.string()
    .required()
    .trim()
    .lowercase()
    .max(255)
    .pattern(EMAIL_PATTERN)
    .messages({
      'string.pattern.base': AUTH_ERRORS.AUTH001
    }),
  name: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-']+$/)
    .messages({
      'string.pattern.base': AUTH_ERRORS.AUTH001
    }),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      'any.only': AUTH_ERRORS.AUTH002
    })
}).meta({ className: 'UserData' });

/**
 * Token refresh request validation schema
 * Validates JWT refresh token format and expiry
 */
export const tokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .trim()
    .min(100)
    .max(1000)
    .pattern(/^[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+$/)
    .messages({
      'string.pattern.base': AUTH_ERRORS.AUTH001
    })
}).meta({ className: 'TokenRequest' });

/**
 * Validates login request data with enhanced security checks
 * @param loginData - The login request data to validate
 * @returns Promise<ValidationResult> - Validation result with sanitized data or error
 */
export async function validateLoginRequest(loginData: unknown): Promise<ValidationResult> {
  try {
    // Get cached schema or compile new one
    let schema = SCHEMA_CACHE.get('login');
    if (!schema) {
      schema = loginSchema;
      SCHEMA_CACHE.set('login', schema);
    }

    // Validate and sanitize input
    const { value, error } = schema.validate(loginData, {
      stripUnknown: true,
      abortEarly: false,
      convert: true
    });

    if (error) {
      return {
        isValid: false,
        error: {
          code: 'AUTH001',
          message: AUTH_ERRORS.AUTH001,
          details: error.details
        }
      };
    }

    return {
      isValid: true,
      data: value
    };
  } catch (error) {
    return {
      isValid: false,
      error: {
        code: 'AUTH001',
        message: AUTH_ERRORS.AUTH001
      }
    };
  }
}

/**
 * Validates user data with strict type checking and sanitization
 * @param userData - The user data to validate
 * @returns Promise<ValidationResult> - Validation result with sanitized data or error
 */
export async function validateUserData(userData: unknown): Promise<ValidationResult<User>> {
  try {
    // Get cached schema or compile new one
    let schema = SCHEMA_CACHE.get('user');
    if (!schema) {
      schema = userSchema;
      SCHEMA_CACHE.set('user', schema);
    }

    // Validate and sanitize input
    const { value, error } = schema.validate(userData, {
      stripUnknown: true,
      abortEarly: false,
      convert: true
    });

    if (error) {
      return {
        isValid: false,
        error: {
          code: 'AUTH001',
          message: AUTH_ERRORS.AUTH001,
          details: error.details
        }
      };
    }

    return {
      isValid: true,
      data: value as User
    };
  } catch (error) {
    return {
      isValid: false,
      error: {
        code: 'AUTH001',
        message: AUTH_ERRORS.AUTH001
      }
    };
  }
}

/**
 * Validates token refresh request with JWT format validation
 * @param tokenData - The token request data to validate
 * @returns Promise<ValidationResult> - Validation result with sanitized data or error
 */
export async function validateTokenRequest(tokenData: unknown): Promise<ValidationResult> {
  try {
    // Get cached schema or compile new one
    let schema = SCHEMA_CACHE.get('token');
    if (!schema) {
      schema = tokenSchema;
      SCHEMA_CACHE.set('token', schema);
    }

    // Validate and sanitize input
    const { value, error } = schema.validate(tokenData, {
      stripUnknown: true,
      abortEarly: false,
      convert: true
    });

    if (error) {
      return {
        isValid: false,
        error: {
          code: 'AUTH001',
          message: AUTH_ERRORS.AUTH001,
          details: error.details
        }
      };
    }

    return {
      isValid: true,
      data: value
    };
  } catch (error) {
    return {
      isValid: false,
      error: {
        code: 'AUTH001',
        message: AUTH_ERRORS.AUTH001
      }
    };
  }
}