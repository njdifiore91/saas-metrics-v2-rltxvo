/**
 * Mock User Data for Testing
 * Provides comprehensive test data for authentication, authorization, and user management
 * @version 1.0.0
 */

import { User, UserRole, UserSession } from '../../backend/src/shared/interfaces/user.interface';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

/**
 * Generates a mock user with specified role and optional overrides
 * @param role - UserRole to assign to the mock user
 * @param overrides - Optional property overrides
 * @returns Complete mock user object
 */
export const generateMockUser = (role: UserRole, overrides: Partial<User> = {}): User => {
  const baseUser: User = {
    id: uuidv4(),
    email: `test-${role.toLowerCase()}@startupmetrics.test`,
    name: `Test ${role.charAt(0)}${role.slice(1).toLowerCase()}`,
    role,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    lastLoginAt: new Date(),
    isActive: true,
    ...overrides
  };

  return baseUser;
};

/**
 * Predefined mock users for different roles and states
 */
export const mockUsers = {
  mockAdminUser: generateMockUser(UserRole.ADMIN, {
    email: 'admin@startupmetrics.test',
    name: 'Admin User'
  }),

  mockAnalystUser: generateMockUser(UserRole.ANALYST, {
    email: 'analyst@startupmetrics.test',
    name: 'Analyst User'
  }),

  mockRegularUser: generateMockUser(UserRole.USER, {
    email: 'user@startupmetrics.test',
    name: 'Regular User'
  }),

  mockGuestUser: generateMockUser(UserRole.GUEST, {
    email: 'guest@startupmetrics.test',
    name: 'Guest User'
  }),

  mockInactiveUser: generateMockUser(UserRole.USER, {
    email: 'inactive@startupmetrics.test',
    name: 'Inactive User',
    isActive: false,
    lastLoginAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
  })
};

/**
 * Mock session data for testing authentication scenarios
 */
export const mockUserSessions: Record<string, UserSession> = {
  validSession: {
    userId: mockUsers.mockRegularUser.id,
    token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...', // Simulated JWT token
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    createdAt: new Date(),
    lastActivityAt: new Date(),
    ipAddress: '192.168.1.1'
  },

  expiredSession: {
    userId: mockUsers.mockRegularUser.id,
    token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...', // Simulated JWT token
    expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    lastActivityAt: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
    ipAddress: '192.168.1.2'
  },

  inactiveSession: {
    userId: mockUsers.mockInactiveUser.id,
    token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...', // Simulated JWT token
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    lastActivityAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    ipAddress: '192.168.1.3'
  }
};

/**
 * Mock concurrent sessions for testing session limits
 */
export const mockConcurrentSessions: UserSession[] = Array(3).fill(null).map((_, index) => ({
  userId: mockUsers.mockRegularUser.id,
  token: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9_${index}...`, // Unique simulated JWT tokens
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  createdAt: new Date(Date.now() - index * 60 * 1000), // Staggered creation times
  lastActivityAt: new Date(Date.now() - index * 30 * 1000), // Staggered activity times
  ipAddress: `192.168.1.${10 + index}` // Unique IP addresses
}));