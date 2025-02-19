/**
 * AdminController - Express controller for secure admin user management operations
 * Implements comprehensive security controls and monitoring as per Technical Specifications 7.1 and 7.3
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';  // v4.18.2
import rateLimit from 'express-rate-limit';  // v6.7.0
import { StatusCodes } from 'http-status-codes';  // v2.2.0
import { AdminService } from '../services/admin.service';
import { validateAdminData, validateAdminUpdate } from '../validators/admin.validator';
import { Logger } from '../../shared/utils/logger';
import { AUTH_ERRORS, DATA_ERRORS, SYSTEM_ERRORS, ErrorResponse } from '../../shared/constants/error-codes';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * AdminController class implementing secure admin user management endpoints
 * with comprehensive security controls and monitoring
 */
export class AdminController {
    private adminService: AdminService;
    private logger: Logger;
    private rateLimiter: any;

    constructor() {
        this.adminService = new AdminService();
        this.logger = new Logger('AdminController');
        
        // Configure rate limiting middleware
        this.rateLimiter = rateLimit({
            windowMs: RATE_LIMIT_WINDOW_MS,
            max: RATE_LIMIT_MAX_REQUESTS,
            message: { error: SYSTEM_ERRORS.SYS001 }
        });
    }

    /**
     * Creates a new admin user with comprehensive validation and security checks
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = `create-admin-${Date.now()}`;
        
        try {
            this.logger.info('Admin creation request received', {
                correlationId,
                requestBody: req.body
            });

            // Validate admin data
            await validateAdminData(req.body);

            // Validate admin access
            const hasAccess = await this.adminService.validateAdminAccess(req.user?.id);
            if (!hasAccess) {
                throw new Error(AUTH_ERRORS.AUTH002);
            }

            // Create admin user
            const createdAdmin = await this.adminService.createAdminUser(req.body);

            this.logger.info('Admin user created successfully', {
                correlationId,
                adminId: createdAdmin.id
            });

            res.status(StatusCodes.CREATED).json({
                success: true,
                data: createdAdmin
            });
        } catch (error) {
            this.logger.error('Admin creation failed', error);
            next(error);
        }
    };

    /**
     * Retrieves an admin user by ID with security validation
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public getAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = `get-admin-${Date.now()}`;
        
        try {
            const { id } = req.params;

            this.logger.info('Admin retrieval request received', {
                correlationId,
                adminId: id
            });

            // Validate admin access
            const hasAccess = await this.adminService.validateAdminAccess(req.user?.id);
            if (!hasAccess) {
                throw new Error(AUTH_ERRORS.AUTH002);
            }

            const admin = await this.adminService.getAdminUser(id);
            if (!admin) {
                res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    error: 'Admin user not found'
                });
                return;
            }

            res.status(StatusCodes.OK).json({
                success: true,
                data: admin
            });
        } catch (error) {
            this.logger.error('Admin retrieval failed', error);
            next(error);
        }
    };

    /**
     * Updates an admin user with security validation and audit logging
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public updateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = `update-admin-${Date.now()}`;
        
        try {
            const { id } = req.params;

            this.logger.info('Admin update request received', {
                correlationId,
                adminId: id,
                updateData: req.body
            });

            // Validate update data
            await validateAdminUpdate(req.body);

            // Validate admin access
            const hasAccess = await this.adminService.validateAdminAccess(req.user?.id);
            if (!hasAccess) {
                throw new Error(AUTH_ERRORS.AUTH002);
            }

            const updatedAdmin = await this.adminService.updateAdminUser(id, req.body);

            this.logger.info('Admin user updated successfully', {
                correlationId,
                adminId: updatedAdmin.id
            });

            res.status(StatusCodes.OK).json({
                success: true,
                data: updatedAdmin
            });
        } catch (error) {
            this.logger.error('Admin update failed', error);
            next(error);
        }
    };

    /**
     * Deletes an admin user with security validation and audit logging
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = `delete-admin-${Date.now()}`;
        
        try {
            const { id } = req.params;

            this.logger.info('Admin deletion request received', {
                correlationId,
                adminId: id
            });

            // Validate admin access
            const hasAccess = await this.adminService.validateAdminAccess(req.user?.id);
            if (!hasAccess) {
                throw new Error(AUTH_ERRORS.AUTH002);
            }

            await this.adminService.deleteAdminUser(id);

            this.logger.info('Admin user deleted successfully', {
                correlationId,
                adminId: id
            });

            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            this.logger.error('Admin deletion failed', error);
            next(error);
        }
    };

    /**
     * Lists admin users with pagination and security filtering
     * @param req Express request object
     * @param res Express response object
     * @param next Express next function
     */
    public listAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const correlationId = `list-admins-${Date.now()}`;
        
        try {
            const { page = 1, limit = 10 } = req.query;

            this.logger.info('Admin list request received', {
                correlationId,
                page,
                limit
            });

            // Validate admin access
            const hasAccess = await this.adminService.validateAdminAccess(req.user?.id);
            if (!hasAccess) {
                throw new Error(AUTH_ERRORS.AUTH002);
            }

            const admins = await this.adminService.listAdminUsers({
                page: Number(page),
                limit: Number(limit)
            });

            res.status(StatusCodes.OK).json({
                success: true,
                data: admins,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: admins.length
                }
            });
        } catch (error) {
            this.logger.error('Admin list retrieval failed', error);
            next(error);
        }
    };

    /**
     * Returns the rate limiter middleware
     * @returns Rate limiter middleware
     */
    public getRateLimiter(): any {
        return this.rateLimiter;
    }
}