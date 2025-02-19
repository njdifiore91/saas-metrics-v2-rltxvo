import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from 'jest';
import supertest, { SuperTest, Test } from 'supertest'; // v6.3.3
import { faker } from '@faker-js/faker'; // v8.0.0
import { AdminService } from '../../../backend/src/admin-service/src/services/admin.service';
import { User, UserRole } from '../../../backend/src/shared/interfaces/user.interface';
import { TestDatabaseManager } from '@testing-library/database-manager'; // v1.0.0
import { SecurityTestUtils } from '@testing-library/security-utils'; // v1.0.0
import { AUTH_ERRORS, DATA_ERRORS, SYSTEM_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('Admin User Management Integration Tests', () => {
  let adminService: AdminService;
  let testAgent: SuperTest<Test>;
  let dbManager: TestDatabaseManager;
  let securityUtils: SecurityTestUtils;
  let testAdminUser: User;

  beforeAll(async () => {
    // Initialize test database with transaction support
    dbManager = new TestDatabaseManager({
      isolationLevel: 'READ COMMITTED',
      logging: false
    });
    await dbManager.connect();

    // Initialize security utilities
    securityUtils = new SecurityTestUtils({
      encryptionKey: process.env.TEST_ENCRYPTION_KEY,
      auditLogPath: 'test/logs/admin-audit.log'
    });

    // Initialize admin service
    adminService = new AdminService();

    // Create test server and supertest agent
    testAgent = supertest(process.env.TEST_API_URL);

    // Configure rate limiting for tests
    process.env.RATE_LIMIT_WINDOW = '3600000'; // 1 hour
    process.env.MAX_OPERATIONS_PER_WINDOW = '100';
  });

  beforeEach(async () => {
    // Start transaction for test isolation
    await dbManager.startTransaction();

    // Create test admin user
    testAdminUser = await adminService.createAdminUser({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password: faker.internet.password({ length: 16 }),
      mfaEnabled: true
    });
  });

  afterEach(async () => {
    // Rollback transaction to ensure test isolation
    await dbManager.rollbackTransaction();
    
    // Reset rate limiting counters
    await securityUtils.resetRateLimits();
  });

  afterAll(async () => {
    // Cleanup test resources
    await dbManager.disconnect();
    
    // Store final audit logs
    await securityUtils.storeAuditLogs();
    
    // Generate security test report
    await securityUtils.generateSecurityReport();
  });

  describe('Admin User Creation', () => {
    it('should successfully create a new admin user with proper security validation', async () => {
      const adminData = {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        password: faker.internet.password({ length: 16 }),
        securityQuestions: [
          {
            question: "What was your first pet's name?",
            answer: faker.lorem.word()
          }
        ],
        mfaEnabled: true
      };

      const response = await testAgent
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`)
        .send(adminData);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(adminData.email);
      expect(response.body.data.role).toBe(UserRole.ADMIN);
      
      // Verify security headers
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      
      // Verify audit log entry
      const auditLog = await securityUtils.getLastAuditLog();
      expect(auditLog.event).toBe('ADMIN_CREATED');
      expect(auditLog.metadata.email).toBe(adminData.email);
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswordData = {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        password: 'weak',
        mfaEnabled: true
      };

      const response = await testAgent
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`)
        .send(weakPasswordData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('DATA003');
      expect(response.body.message).toContain('Password must be at least 12 characters');
    });
  });

  describe('Session Management', () => {
    it('should properly manage concurrent admin sessions', async () => {
      // Create multiple sessions
      const session1 = await securityUtils.createTestSession(testAdminUser);
      const session2 = await securityUtils.createTestSession(testAdminUser);
      const session3 = await securityUtils.createTestSession(testAdminUser);
      
      // Attempt to create session beyond limit
      const session4Response = await testAgent
        .post('/api/v1/admin/sessions')
        .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`);

      expect(session4Response.status).toBe(400);
      expect(session4Response.body.code).toBe('AUTH005');
      
      // Verify session audit logs
      const sessionLogs = await securityUtils.getSessionAuditLogs(testAdminUser.id);
      expect(sessionLogs).toHaveLength(3);
    });

    it('should enforce session timeout', async () => {
      const session = await securityUtils.createTestSession(testAdminUser);
      
      // Fast-forward time by 31 minutes
      await securityUtils.advanceTime(31 * 60 * 1000);
      
      const response = await testAgent
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${session.token}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH004');
    });
  });

  describe('Security Controls', () => {
    it('should enforce rate limiting for admin operations', async () => {
      const createRequests = Array(101).fill(null).map(() => 
        testAgent
          .post('/api/v1/admin/users')
          .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`)
          .send({
            email: faker.internet.email(),
            name: faker.person.fullName(),
            password: faker.internet.password({ length: 16 }),
            mfaEnabled: true
          })
      );

      const responses = await Promise.all(createRequests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.code).toBe('SYS001');
    });

    it('should validate input sanitization', async () => {
      const maliciousData = {
        email: faker.internet.email(),
        name: '<script>alert("xss")</script>',
        password: faker.internet.password({ length: 16 })
      };

      const response = await testAgent
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`)
        .send(maliciousData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('DATA003');
    });

    it('should verify encryption at rest', async () => {
      const adminData = {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        password: faker.internet.password({ length: 16 }),
        mfaEnabled: true
      };

      const response = await testAgent
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${securityUtils.generateTestToken(testAdminUser)}`)
        .send(adminData);

      const dbRecord = await dbManager.getRawUserRecord(response.body.data.id);
      expect(dbRecord.password).not.toBe(adminData.password);
      expect(securityUtils.isEncrypted(dbRecord.password)).toBe(true);
    });
  });
});