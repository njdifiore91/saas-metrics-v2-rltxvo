/**
 * AdminService - Secure admin user management service implementation
 * Implements comprehensive security controls and audit logging as per Technical Specifications 7.1 and 7.3
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { AdminModel } from '../models/admin.model';
import { User, UserRole } from '../../shared/interfaces/user.interface';
import { Logger } from '../../shared/utils/logger';

// Validation schemas for admin operations
const adminCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(12),
  securityQuestions: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional(),
  mfaEnabled: z.boolean().optional()
});

const adminUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  password: z.string().min(12).optional(),
  securityQuestions: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional(),
  mfaEnabled: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const paginationSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * Service class for secure admin user management operations
 * Implements role-based access control and security audit logging
 */
export class AdminService {
  private adminModel: AdminModel;
  private logger: Logger;
  private readonly RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
  private readonly MAX_OPERATIONS_PER_WINDOW = 100;
  private operationCounter: Map<string, { count: number; timestamp: number }>;

  constructor() {
    this.adminModel = new AdminModel();
    this.logger = new Logger('AdminService');
    this.operationCounter = new Map();
  }

  /**
   * Creates a new administrator user with enhanced security validation
   * @param adminData - Admin user creation data
   * @returns Promise<User> - Created admin user
   */
  async createAdminUser(adminData: z.infer<typeof adminCreateSchema>): Promise<User> {
    try {
      // Validate admin data
      const validatedData = adminCreateSchema.parse(adminData);

      // Check rate limiting
      if (this.isRateLimited('createAdmin')) {
        this.logger.error('Rate limit exceeded for admin creation', new Error('RATE_LIMIT_EXCEEDED'));
        throw new Error('Rate limit exceeded for admin operations');
      }

      // Create admin user
      const createdAdmin = await this.adminModel.createAdmin({
        ...validatedData,
        mfaEnabled: validatedData.mfaEnabled ?? true // MFA enabled by default for admins
      });

      this.logger.info('Admin user created successfully', {
        adminId: createdAdmin.id,
        email: createdAdmin.email
      });

      return createdAdmin;
    } catch (error) {
      this.logger.error('Admin creation failed', error);
      throw error;
    }
  }

  /**
   * Retrieves an admin user by ID with security validation
   * @param id - Admin user ID
   * @returns Promise<User | null> - Admin user if found
   */
  async getAdminUser(id: string): Promise<User | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid admin ID format');
      }

      const admin = await this.adminModel.getAdminById(id);

      if (admin) {
        this.logger.info('Admin user retrieved', {
          adminId: admin.id,
          email: admin.email
        });
      }

      return admin;
    } catch (error) {
      this.logger.error('Admin retrieval failed', error);
      throw error;
    }
  }

  /**
   * Updates an existing admin user with security validation
   * @param id - Admin user ID
   * @param updateData - Admin update data
   * @returns Promise<User> - Updated admin user
   */
  async updateAdminUser(
    id: string,
    updateData: z.infer<typeof adminUpdateSchema>
  ): Promise<User> {
    try {
      // Validate update data
      const validatedData = adminUpdateSchema.parse(updateData);

      // Check rate limiting
      if (this.isRateLimited('updateAdmin')) {
        throw new Error('Rate limit exceeded for admin operations');
      }

      // Verify admin exists
      const existingAdmin = await this.getAdminUser(id);
      if (!existingAdmin) {
        throw new Error('Admin user not found');
      }

      const updatedAdmin = await this.adminModel.updateAdmin(id, validatedData);

      this.logger.info('Admin user updated successfully', {
        adminId: updatedAdmin.id,
        email: updatedAdmin.email,
        updatedFields: Object.keys(validatedData)
      });

      return updatedAdmin;
    } catch (error) {
      this.logger.error('Admin update failed', error);
      throw error;
    }
  }

  /**
   * Deletes an admin user with security validation
   * @param id - Admin user ID
   * @returns Promise<void>
   */
  async deleteAdminUser(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid admin ID format');
      }

      // Check rate limiting
      if (this.isRateLimited('deleteAdmin')) {
        throw new Error('Rate limit exceeded for admin operations');
      }

      // Verify admin exists
      const admin = await this.getAdminUser(id);
      if (!admin) {
        throw new Error('Admin user not found');
      }

      // Ensure at least one admin remains
      const adminCount = (await this.listAdminUsers({ page: 1, limit: 1 })).length;
      if (adminCount <= 1) {
        throw new Error('Cannot delete last admin user');
      }

      await this.adminModel.deleteAdmin(id);

      this.logger.info('Admin user deleted successfully', {
        adminId: id,
        email: admin.email
      });
    } catch (error) {
      this.logger.error('Admin deletion failed', error);
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of admin users
   * @param options - Pagination options
   * @returns Promise<User[]> - Array of admin users
   */
  async listAdminUsers(
    options: z.infer<typeof paginationSchema>
  ): Promise<User[]> {
    try {
      const validatedOptions = paginationSchema.parse(options);

      const admins = await this.adminModel.listAdmins(validatedOptions);

      this.logger.info('Admin list retrieved', {
        page: validatedOptions.page,
        limit: validatedOptions.limit,
        totalResults: admins.length
      });

      return admins;
    } catch (error) {
      this.logger.error('Admin list retrieval failed', error);
      throw error;
    }
  }

  /**
   * Validates if a user has admin access
   * @param userId - User ID to validate
   * @returns Promise<boolean> - True if user has admin access
   */
  async validateAdminAccess(userId: string): Promise<boolean> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID format');
      }

      const user = await this.getAdminUser(userId);
      if (!user) {
        return false;
      }

      const hasAdminRole = user.role === UserRole.ADMIN && user.isActive;

      this.logger.info('Admin access validated', {
        userId,
        hasAccess: hasAdminRole
      });

      return hasAdminRole;
    } catch (error) {
      this.logger.error('Admin validation failed', error);
      return false;
    }
  }

  /**
   * Checks if operations are rate limited
   * @private
   * @param operation - Operation type to check
   * @returns boolean - True if rate limited
   */
  private isRateLimited(operation: string): boolean {
    const now = Date.now();
    const key = `${operation}_${now}`;
    const currentOps = this.operationCounter.get(key);

    if (!currentOps || (now - currentOps.timestamp) > this.RATE_LIMIT_WINDOW) {
      this.operationCounter.set(key, { count: 1, timestamp: now });
      return false;
    }

    if (currentOps.count >= this.MAX_OPERATIONS_PER_WINDOW) {
      return true;
    }

    currentOps.count++;
    this.operationCounter.set(key, currentOps);
    return false;
  }
}