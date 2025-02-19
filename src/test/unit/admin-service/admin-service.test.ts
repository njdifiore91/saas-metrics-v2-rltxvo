import { jest } from '@jest/globals';  // v29.0.0
import { AdminService } from '../../../backend/src/admin-service/src/services/admin.service';
import { AdminModel } from '../../../backend/src/admin-service/src/models/admin.model';
import { Logger } from '../../../backend/src/shared/utils/logger';
import { UserRole } from '../../../backend/src/shared/interfaces/user.interface';
import { AUTH_ERRORS, SYSTEM_ERRORS } from '../../../backend/src/shared/constants/error-codes';

// Mock dependencies
jest.mock('../../../backend/src/admin-service/src/models/admin.model');
jest.mock('../../../backend/src/shared/utils/logger');

describe('AdminService', () => {
  let adminService: AdminService;
  let mockAdminModel: jest.Mocked<AdminModel>;
  let mockLogger: jest.Mocked<Logger>;

  const mockAdminData = {
    id: 'test-admin-id',
    email: 'admin@test.com',
    name: 'Test Admin',
    password: 'securePassword123!',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    mfaEnabled: true
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Initialize mocked dependencies
    mockAdminModel = new AdminModel() as jest.Mocked<AdminModel>;
    mockLogger = new Logger('AdminService') as jest.Mocked<Logger>;
    
    // Initialize service with mocked dependencies
    adminService = new AdminService();
    (adminService as any).adminModel = mockAdminModel;
    (adminService as any).logger = mockLogger;
  });

  describe('createAdminUser', () => {
    it('should create admin user with security validation', async () => {
      // Setup
      mockAdminModel.createAdmin.mockResolvedValue(mockAdminData);

      // Execute
      const result = await adminService.createAdminUser({
        email: mockAdminData.email,
        name: mockAdminData.name,
        password: mockAdminData.password,
        mfaEnabled: true
      });

      // Assert
      expect(mockAdminModel.createAdmin).toHaveBeenCalledWith({
        email: mockAdminData.email,
        name: mockAdminData.name,
        password: mockAdminData.password,
        mfaEnabled: true
      });
      expect(result).toEqual(mockAdminData);
      expect(mockLogger.info).toHaveBeenCalledWith('Admin user created successfully', {
        adminId: mockAdminData.id,
        email: mockAdminData.email
      });
    });

    it('should enforce rate limiting on admin creation', async () => {
      // Setup
      const operations = Array(101).fill(null);
      
      // Execute & Assert
      for (let i = 0; i < operations.length; i++) {
        if (i < 100) {
          await expect(adminService.createAdminUser(mockAdminData)).resolves.toBeDefined();
        } else {
          await expect(adminService.createAdminUser(mockAdminData))
            .rejects.toThrow('Rate limit exceeded for admin operations');
        }
      }
    });

    it('should validate admin data before creation', async () => {
      // Setup
      const invalidData = {
        email: 'invalid-email',
        name: '',
        password: 'short'
      };

      // Execute & Assert
      await expect(adminService.createAdminUser(invalidData))
        .rejects.toThrow();
      expect(mockAdminModel.createAdmin).not.toHaveBeenCalled();
    });
  });

  describe('getAdminUser', () => {
    it('should retrieve admin user with security validation', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);

      // Execute
      const result = await adminService.getAdminUser(mockAdminData.id);

      // Assert
      expect(result).toEqual(mockAdminData);
      expect(mockLogger.info).toHaveBeenCalledWith('Admin user retrieved', {
        adminId: mockAdminData.id,
        email: mockAdminData.email
      });
    });

    it('should handle non-existent admin user', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(null);

      // Execute
      const result = await adminService.getAdminUser('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateAdminUser', () => {
    it('should update admin user with security validation', async () => {
      // Setup
      const updateData = {
        name: 'Updated Name',
        mfaEnabled: true
      };
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);
      mockAdminModel.updateAdmin.mockResolvedValue({ ...mockAdminData, ...updateData });

      // Execute
      const result = await adminService.updateAdminUser(mockAdminData.id, updateData);

      // Assert
      expect(result).toEqual({ ...mockAdminData, ...updateData });
      expect(mockLogger.info).toHaveBeenCalledWith('Admin user updated successfully', {
        adminId: mockAdminData.id,
        email: mockAdminData.email,
        updatedFields: Object.keys(updateData)
      });
    });

    it('should enforce rate limiting on admin updates', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);
      const operations = Array(101).fill(null);
      
      // Execute & Assert
      for (let i = 0; i < operations.length; i++) {
        if (i < 100) {
          await expect(adminService.updateAdminUser(mockAdminData.id, { name: 'Test' }))
            .resolves.toBeDefined();
        } else {
          await expect(adminService.updateAdminUser(mockAdminData.id, { name: 'Test' }))
            .rejects.toThrow(SYSTEM_ERRORS.SYS001);
        }
      }
    });
  });

  describe('deleteAdminUser', () => {
    it('should delete admin user with security validation', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);
      mockAdminModel.listAdmins.mockResolvedValue([mockAdminData, { ...mockAdminData, id: 'other-admin' }]);

      // Execute
      await adminService.deleteAdminUser(mockAdminData.id);

      // Assert
      expect(mockAdminModel.deleteAdmin).toHaveBeenCalledWith(mockAdminData.id);
      expect(mockLogger.info).toHaveBeenCalledWith('Admin user deleted successfully', {
        adminId: mockAdminData.id,
        email: mockAdminData.email
      });
    });

    it('should prevent deletion of last admin user', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);
      mockAdminModel.listAdmins.mockResolvedValue([mockAdminData]);

      // Execute & Assert
      await expect(adminService.deleteAdminUser(mockAdminData.id))
        .rejects.toThrow('Cannot delete last admin user');
    });
  });

  describe('validateAdminAccess', () => {
    it('should validate admin access correctly', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue(mockAdminData);

      // Execute
      const result = await adminService.validateAdminAccess(mockAdminData.id);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Admin access validated', {
        userId: mockAdminData.id,
        hasAccess: true
      });
    });

    it('should deny access for non-admin users', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue({
        ...mockAdminData,
        role: UserRole.USER
      });

      // Execute
      const result = await adminService.validateAdminAccess(mockAdminData.id);

      // Assert
      expect(result).toBe(false);
    });

    it('should deny access for inactive admin users', async () => {
      // Setup
      mockAdminModel.getAdminById.mockResolvedValue({
        ...mockAdminData,
        isActive: false
      });

      // Execute
      const result = await adminService.validateAdminAccess(mockAdminData.id);

      // Assert
      expect(result).toBe(false);
    });
  });
});