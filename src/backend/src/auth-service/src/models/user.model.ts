/**
 * User Model Implementation for Auth Service
 * Provides type-safe database operations and secure user management functionality
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import { User, UserRole } from '../../shared/interfaces/user.interface';
import { validate as validateEmail } from 'email-validator';

/**
 * Implements comprehensive user management with Prisma ORM
 * Handles database operations, validation, and audit logging for user data
 */
export class UserModel {
    private prisma: PrismaClient;

    constructor(prismaClient: PrismaClient) {
        this.prisma = prismaClient;
    }

    /**
     * Creates a new user with validation and error handling
     * @param userData User creation data without system-managed fields
     * @throws {Error} If validation fails or database operation errors
     */
    async createUser(
        userData: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>
    ): Promise<User> {
        // Validate email format
        if (!validateEmail(userData.email)) {
            throw new Error('Invalid email format');
        }

        // Check email uniqueness
        const existingUser = await this.findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error('Email already registered');
        }

        // Validate role assignment
        if (!Object.values(UserRole).includes(userData.role)) {
            throw new Error('Invalid user role');
        }

        try {
            const user = await this.prisma.user.create({
                data: {
                    email: userData.email.toLowerCase(),
                    name: userData.name.trim(),
                    role: userData.role,
                    isActive: userData.isActive,
                    createdAt: new Date(),
                    lastLoginAt: new Date()
                }
            });

            return user as User;
        } catch (error) {
            throw new Error(`User creation failed: ${error.message}`);
        }
    }

    /**
     * Finds a user by their unique identifier
     * @param id User's UUID
     */
    async findUserById(id: string): Promise<User | null> {
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid user ID');
        }

        try {
            const user = await this.prisma.user.findUnique({
                where: { id }
            });

            return user as User | null;
        } catch (error) {
            throw new Error(`User lookup failed: ${error.message}`);
        }
    }

    /**
     * Finds a user by their email address
     * @param email User's email address
     */
    async findUserByEmail(email: string): Promise<User | null> {
        if (!validateEmail(email)) {
            throw new Error('Invalid email format');
        }

        try {
            const user = await this.prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            return user as User | null;
        } catch (error) {
            throw new Error(`User lookup failed: ${error.message}`);
        }
    }

    /**
     * Updates user information with validation and role checks
     * @param id User's UUID
     * @param userData Partial user data to update
     */
    async updateUser(
        id: string,
        userData: Partial<Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>>
    ): Promise<User> {
        // Validate user existence
        const existingUser = await this.findUserById(id);
        if (!existingUser) {
            throw new Error('User not found');
        }

        // Validate email if being updated
        if (userData.email) {
            if (!validateEmail(userData.email)) {
                throw new Error('Invalid email format');
            }
            // Check email uniqueness excluding current user
            const emailUser = await this.findUserByEmail(userData.email);
            if (emailUser && emailUser.id !== id) {
                throw new Error('Email already registered');
            }
        }

        // Validate role if being updated
        if (userData.role && !Object.values(UserRole).includes(userData.role)) {
            throw new Error('Invalid user role');
        }

        try {
            const updatedUser = await this.prisma.user.update({
                where: { id },
                data: {
                    ...userData,
                    email: userData.email?.toLowerCase(),
                    name: userData.name?.trim()
                }
            });

            return updatedUser as User;
        } catch (error) {
            throw new Error(`User update failed: ${error.message}`);
        }
    }

    /**
     * Updates user's last login timestamp
     * @param id User's UUID
     */
    async updateLastLogin(id: string): Promise<void> {
        try {
            await this.prisma.user.update({
                where: { id },
                data: { lastLoginAt: new Date() }
            });
        } catch (error) {
            throw new Error(`Login timestamp update failed: ${error.message}`);
        }
    }
}