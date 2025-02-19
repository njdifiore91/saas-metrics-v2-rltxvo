/**
 * Admin Validator Module
 * Implements comprehensive validation schemas and functions for admin user data
 * with enhanced security checks and strict validation rules.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { User, UserRole } from '../../shared/interfaces/user.interface';

// Constants for validation rules
const ADMIN_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ADMIN_NAME_MIN_LENGTH = 2;
const ADMIN_NAME_MAX_LENGTH = 100;
const ALLOWED_EMAIL_DOMAINS = ['company.com', 'admin.company.com'];

/**
 * Enhanced Zod schema for admin user data validation
 * Implements strict validation rules for admin user creation
 */
export const adminSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .regex(ADMIN_EMAIL_REGEX, 'Email format does not meet security requirements')
    .refine(
      (email) => ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain)),
      'Email domain not authorized for admin access'
    ),
  name: z.string()
    .min(ADMIN_NAME_MIN_LENGTH, `Name must be at least ${ADMIN_NAME_MIN_LENGTH} characters`)
    .max(ADMIN_NAME_MAX_LENGTH, `Name cannot exceed ${ADMIN_NAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(name => name.trim()),
  role: z.enum([UserRole.ADMIN], {
    errorMap: () => ({ message: 'Role must be set to ADMIN for admin users' })
  })
});

/**
 * Enhanced Zod schema for admin update validation
 * Implements strict validation rules for admin user updates
 */
export const adminUpdateSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .regex(ADMIN_EMAIL_REGEX, 'Email format does not meet security requirements')
    .refine(
      (email) => ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain)),
      'Email domain not authorized for admin access'
    )
    .optional(),
  name: z.string()
    .min(ADMIN_NAME_MIN_LENGTH, `Name must be at least ${ADMIN_NAME_MIN_LENGTH} characters`)
    .max(ADMIN_NAME_MAX_LENGTH, `Name cannot exceed ${ADMIN_NAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(name => name.trim())
    .optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

/**
 * Validates admin user data with enhanced security checks
 * @param adminData - The admin user data to validate
 * @returns Promise<boolean> - Returns true if validation passes, throws error if fails
 */
export async function validateAdminData(adminData: Partial<User>): Promise<boolean> {
  try {
    // Apply schema validation with enhanced security checks
    const validatedData = await adminSchema.parseAsync(adminData);

    // Additional security validations
    if (validatedData.email.toLowerCase() !== adminData.email?.toLowerCase()) {
      throw new Error('Email case mismatch detected');
    }

    if (validatedData.role !== UserRole.ADMIN) {
      throw new Error('Invalid role assignment for admin user');
    }

    // Log validation success (implement actual logging in production)
    console.info(`Admin validation passed for email: ${validatedData.email}`);

    return true;
  } catch (error) {
    // Log validation failure (implement actual logging in production)
    console.error(`Admin validation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Validates admin update data with strict security measures
 * @param updateData - The admin update data to validate
 * @returns Promise<boolean> - Returns true if validation passes, throws error if fails
 */
export async function validateAdminUpdate(updateData: Partial<User>): Promise<boolean> {
  try {
    // Prevent role modification attempts
    if ('role' in updateData) {
      throw new Error('Role modification not allowed in admin update');
    }

    // Apply schema validation with enhanced security checks
    const validatedData = await adminUpdateSchema.parseAsync(updateData);

    // Additional security validations for email updates
    if (validatedData.email) {
      if (validatedData.email.toLowerCase() !== updateData.email?.toLowerCase()) {
        throw new Error('Email case mismatch detected');
      }
    }

    // Log update validation success (implement actual logging in production)
    console.info(`Admin update validation passed for data:`, validatedData);

    return true;
  } catch (error) {
    // Log update validation failure (implement actual logging in production)
    console.error(`Admin update validation failed: ${error.message}`);
    throw error;
  }
}