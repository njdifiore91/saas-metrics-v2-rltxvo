/**
 * Enhanced Admin Model for secure administrator user management
 * Implements comprehensive security measures and data classification as per Technical Specifications 7.1 and 7.2
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import { AES, enc } from 'crypto-js';
import { createLogger, format, transports } from 'winston';
import { User, UserRole } from '../../shared/interfaces/user.interface';

// Encryption key should be stored in secure environment variables
const ENCRYPTION_KEY = process.env.ADMIN_ENCRYPTION_KEY || '';

// Configure audit logger
const auditLogger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.File({ filename: 'logs/admin-audit.log' })
    ]
});

/**
 * Interface for admin creation data with enhanced security fields
 */
interface AdminCreationData {
    email: string;
    name: string;
    password: string;
    securityQuestions?: {
        question: string;
        answer: string;
    }[];
    mfaEnabled?: boolean;
}

/**
 * Interface for admin update data with security measures
 */
interface AdminUpdateData {
    email?: string;
    name?: string;
    password?: string;
    securityQuestions?: {
        question: string;
        answer: string;
    }[];
    mfaEnabled?: boolean;
    isActive?: boolean;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * AdminModel class implementing secure admin user management
 * Includes comprehensive security measures, data classification, and audit logging
 */
export class AdminModel {
    private prisma: PrismaClient;
    private logger: typeof auditLogger;

    constructor() {
        this.prisma = new PrismaClient();
        this.logger = auditLogger;
    }

    /**
     * Creates a new admin user with enhanced security measures
     * @param adminData - Admin user creation data
     * @returns Promise<User> - Created admin user
     */
    async createAdmin(adminData: AdminCreationData): Promise<User> {
        try {
            // Validate admin data
            this.validateAdminData(adminData);

            // Encrypt sensitive information
            const encryptedData = this.encryptSensitiveData({
                password: adminData.password,
                securityQuestions: adminData.securityQuestions
            });

            // Create admin user within transaction
            const admin = await this.prisma.$transaction(async (prisma) => {
                const newAdmin = await prisma.user.create({
                    data: {
                        email: adminData.email,
                        name: adminData.name,
                        role: UserRole.ADMIN,
                        isActive: true,
                        createdAt: new Date(),
                        lastLoginAt: new Date(),
                        encryptedPassword: encryptedData.password,
                        securityQuestions: encryptedData.securityQuestions,
                        mfaEnabled: adminData.mfaEnabled ?? true
                    }
                });

                // Log admin creation in audit trail
                this.logAuditEvent('ADMIN_CREATED', newAdmin.id, {
                    email: newAdmin.email,
                    name: newAdmin.name
                });

                return newAdmin;
            });

            return this.sanitizeAdminData(admin);
        } catch (error) {
            this.logAuditEvent('ADMIN_CREATION_FAILED', null, { error: error.message });
            throw new Error(`Admin creation failed: ${error.message}`);
        }
    }

    /**
     * Securely retrieves an admin user by ID with data classification
     * @param id - Admin user ID
     * @returns Promise<User | null> - Admin user if found
     */
    async getAdminById(id: string): Promise<User | null> {
        try {
            const admin = await this.prisma.user.findFirst({
                where: {
                    id,
                    role: UserRole.ADMIN
                }
            });

            if (!admin) {
                return null;
            }

            this.logAuditEvent('ADMIN_ACCESSED', admin.id, {
                email: admin.email
            });

            return this.sanitizeAdminData(admin);
        } catch (error) {
            this.logAuditEvent('ADMIN_ACCESS_FAILED', id, { error: error.message });
            throw new Error(`Admin retrieval failed: ${error.message}`);
        }
    }

    /**
     * Updates an admin user with security validation and audit logging
     * @param id - Admin user ID
     * @param updateData - Admin update data
     * @returns Promise<User> - Updated admin user
     */
    async updateAdmin(id: string, updateData: AdminUpdateData): Promise<User> {
        try {
            const existingAdmin = await this.getAdminById(id);
            if (!existingAdmin) {
                throw new Error('Admin not found');
            }

            // Encrypt any sensitive update data
            const encryptedData = this.encryptSensitiveData({
                password: updateData.password,
                securityQuestions: updateData.securityQuestions
            });

            const updatedAdmin = await this.prisma.$transaction(async (prisma) => {
                const admin = await prisma.user.update({
                    where: { id },
                    data: {
                        ...updateData,
                        ...(encryptedData.password && { encryptedPassword: encryptedData.password }),
                        ...(encryptedData.securityQuestions && { securityQuestions: encryptedData.securityQuestions })
                    }
                });

                this.logAuditEvent('ADMIN_UPDATED', admin.id, {
                    email: admin.email,
                    updatedFields: Object.keys(updateData)
                });

                return admin;
            });

            return this.sanitizeAdminData(updatedAdmin);
        } catch (error) {
            this.logAuditEvent('ADMIN_UPDATE_FAILED', id, { error: error.message });
            throw new Error(`Admin update failed: ${error.message}`);
        }
    }

    /**
     * Securely deletes an admin user with audit logging
     * @param id - Admin user ID
     * @returns Promise<void>
     */
    async deleteAdmin(id: string): Promise<void> {
        try {
            const admin = await this.getAdminById(id);
            if (!admin) {
                throw new Error('Admin not found');
            }

            await this.prisma.$transaction(async (prisma) => {
                await prisma.user.delete({
                    where: { id }
                });

                this.logAuditEvent('ADMIN_DELETED', id, {
                    email: admin.email
                });
            });
        } catch (error) {
            this.logAuditEvent('ADMIN_DELETION_FAILED', id, { error: error.message });
            throw new Error(`Admin deletion failed: ${error.message}`);
        }
    }

    /**
     * Retrieves a paginated list of admin users with security filtering
     * @param options - Pagination options
     * @returns Promise<User[]> - Array of admin users
     */
    async listAdmins(options: PaginationOptions): Promise<User[]> {
        try {
            const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;

            const admins = await this.prisma.user.findMany({
                where: {
                    role: UserRole.ADMIN
                },
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip,
                take: limit
            });

            this.logAuditEvent('ADMIN_LIST_ACCESSED', null, {
                page,
                limit,
                totalResults: admins.length
            });

            return admins.map(admin => this.sanitizeAdminData(admin));
        } catch (error) {
            this.logAuditEvent('ADMIN_LIST_ACCESS_FAILED', null, { error: error.message });
            throw new Error(`Admin list retrieval failed: ${error.message}`);
        }
    }

    /**
     * Encrypts sensitive admin data
     * @param data - Sensitive data to encrypt
     * @returns Encrypted data
     */
    private encryptSensitiveData(data: any): any {
        const encrypted: any = {};

        if (data.password) {
            encrypted.password = AES.encrypt(data.password, ENCRYPTION_KEY).toString();
        }

        if (data.securityQuestions) {
            encrypted.securityQuestions = data.securityQuestions.map((q: any) => ({
                question: q.question,
                answer: AES.encrypt(q.answer, ENCRYPTION_KEY).toString()
            }));
        }

        return encrypted;
    }

    /**
     * Validates admin data for required fields and format
     * @param data - Admin data to validate
     */
    private validateAdminData(data: AdminCreationData): void {
        if (!data.email || !data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            throw new Error('Invalid email format');
        }

        if (!data.password || data.password.length < 12) {
            throw new Error('Password must be at least 12 characters long');
        }

        if (!data.name || data.name.length < 2) {
            throw new Error('Name must be at least 2 characters long');
        }
    }

    /**
     * Removes sensitive data from admin user object
     * @param admin - Admin user object
     * @returns Sanitized admin user object
     */
    private sanitizeAdminData(admin: any): User {
        const { encryptedPassword, securityQuestions, ...sanitizedAdmin } = admin;
        return sanitizedAdmin;
    }

    /**
     * Logs admin-related audit events
     * @param event - Event type
     * @param adminId - Admin user ID
     * @param metadata - Additional event metadata
     */
    private logAuditEvent(event: string, adminId: string | null, metadata: any): void {
        this.logger.info({
            event,
            adminId,
            timestamp: new Date().toISOString(),
            metadata,
            ipAddress: process.env.SERVER_IP || 'unknown'
        });
    }
}