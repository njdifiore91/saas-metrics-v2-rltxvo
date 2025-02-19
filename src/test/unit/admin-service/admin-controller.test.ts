import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { jest } from '@jest/globals'; // v29.0.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { AdminController } from '../../../backend/src/admin-service/src/controllers/admin.controller';
import { AdminService } from '../../../backend/src/admin-service/src/services/admin.service';
import { AUTH_ERRORS, DATA_ERRORS, SYSTEM_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { UserRole } from '../../../backend/src/shared/interfaces/user.interface';

describe('AdminController', () => {
    let adminController: AdminController;
    let mockAdminService: jest.Mocked<AdminService>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.MockedFunction<NextFunction>;

    const mockAdmin = {
        id: '123',
        email: 'admin@company.com',
        name: 'Test Admin',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date()
    };

    beforeEach(() => {
        // Mock AdminService
        mockAdminService = {
            createAdminUser: jest.fn(),
            getAdminUser: jest.fn(),
            updateAdminUser: jest.fn(),
            deleteAdminUser: jest.fn(),
            listAdminUsers: jest.fn(),
            validateAdminAccess: jest.fn()
        } as unknown as jest.Mocked<AdminService>;

        // Mock Express request/response
        mockRequest = {
            body: {},
            params: {},
            query: {},
            user: { id: '123', role: UserRole.ADMIN }
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };

        mockNext = jest.fn();

        // Initialize controller with mocked service
        adminController = new AdminController();
        (adminController as any).adminService = mockAdminService;
    });

    describe('createAdmin', () => {
        const validAdminData = {
            email: 'newadmin@company.com',
            name: 'New Admin',
            password: 'SecurePass123!',
            mfaEnabled: true
        };

        it('should successfully create an admin user', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.createAdminUser.mockResolvedValue(mockAdmin);

            mockRequest.body = validAdminData;

            await adminController.createAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockAdmin
            });
        });

        it('should handle unauthorized access', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(false);

            await adminController.createAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(new Error(AUTH_ERRORS.AUTH002));
        });

        it('should handle validation errors', async () => {
            mockRequest.body = { ...validAdminData, email: 'invalid-email' };

            await adminController.createAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle rate limiting', async () => {
            const rateLimiter = adminController.getRateLimiter();
            expect(rateLimiter).toBeDefined();
        });
    });

    describe('getAdmin', () => {
        it('should successfully retrieve an admin user', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.getAdminUser.mockResolvedValue(mockAdmin);

            mockRequest.params = { id: '123' };

            await adminController.getAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockAdmin
            });
        });

        it('should handle non-existent admin', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.getAdminUser.mockResolvedValue(null);

            mockRequest.params = { id: 'nonexistent' };

            await adminController.getAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
        });
    });

    describe('updateAdmin', () => {
        const updateData = {
            name: 'Updated Admin Name'
        };

        it('should successfully update an admin user', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.updateAdminUser.mockResolvedValue({
                ...mockAdmin,
                ...updateData
            });

            mockRequest.params = { id: '123' };
            mockRequest.body = updateData;

            await adminController.updateAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining(updateData)
            });
        });

        it('should handle concurrent update conflicts', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.updateAdminUser.mockRejectedValue(new Error('Concurrent update detected'));

            await adminController.updateAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('deleteAdmin', () => {
        it('should successfully delete an admin user', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.deleteAdminUser.mockResolvedValue();

            mockRequest.params = { id: '123' };

            await adminController.deleteAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
        });

        it('should prevent deletion of last admin', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.deleteAdminUser.mockRejectedValue(new Error('Cannot delete last admin user'));

            await adminController.deleteAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('listAdmins', () => {
        it('should successfully list admin users with pagination', async () => {
            const mockAdmins = [mockAdmin];
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.listAdminUsers.mockResolvedValue(mockAdmins);

            mockRequest.query = { page: '1', limit: '10' };

            await adminController.listAdmins(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockAdmins,
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 1
                }
            });
        });

        it('should handle invalid pagination parameters', async () => {
            mockRequest.query = { page: 'invalid', limit: 'invalid' };

            await adminController.listAdmins(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle service errors gracefully', async () => {
            mockAdminService.validateAdminAccess.mockRejectedValue(new Error(SYSTEM_ERRORS.SYS003));

            await adminController.createAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle validation errors with proper status codes', async () => {
            mockAdminService.validateAdminAccess.mockResolvedValue(true);
            mockAdminService.createAdminUser.mockRejectedValue(new Error(DATA_ERRORS.DATA001));

            await adminController.createAdmin(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalled();
        });
    });
});