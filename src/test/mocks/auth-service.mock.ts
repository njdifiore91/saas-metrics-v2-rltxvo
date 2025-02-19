import { jest } from 'jest';
import { User, UserRole } from '../../backend/src/shared/interfaces/user.interface';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../backend/src/shared/constants/error-codes';
import createHttpError from 'http-errors';

// Mock user data for testing
export const mockUser: User = {
  id: 'mock-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: UserRole.USER,
  createdAt: new Date('2023-01-01T00:00:00Z'),
  lastLoginAt: new Date('2023-01-01T00:00:00Z'),
  isActive: true
};

// Mock JWT token for testing
export const mockToken = 'mock.jwt.token';

// Mock session tracking interface
interface MockSessionData {
  token: string;
  expiresAt: Date;
  lastActivityAt: Date;
}

/**
 * Enhanced mock implementation of AuthService for testing
 * Provides comprehensive test coverage for authentication flows
 */
export class MockAuthService {
  private activeSessions: Map<string, MockSessionData[]>;
  private requestCounts: Map<string, number>;
  private readonly maxSessions: number;
  private readonly rateLimit: number;

  constructor(options: { maxSessions?: number; rateLimit?: number } = {}) {
    this.activeSessions = new Map();
    this.requestCounts = new Map();
    this.maxSessions = options.maxSessions || 3;
    this.rateLimit = options.rateLimit || 100;

    // Initialize session for mock user
    this.activeSessions.set(mockUser.id, [{
      token: mockToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiration
      lastActivityAt: new Date()
    }]);
  }

  /**
   * Mock Google OAuth initiation
   * Simulates rate limiting and session validation
   */
  public initiateGoogleAuth = jest.fn().mockImplementation(async (): Promise<string> => {
    const userId = mockUser.id;
    const requestCount = this.requestCounts.get(userId) || 0;

    // Simulate rate limiting
    if (requestCount >= this.rateLimit) {
      throw createHttpError(HTTP_STATUS_CODES.RATE_LIMIT, {
        code: 'SYS001',
        message: 'Rate limit exceeded'
      });
    }

    // Update request count
    this.requestCounts.set(userId, requestCount + 1);

    return 'https://mock-google-oauth-url.com';
  });

  /**
   * Mock Google OAuth callback handler
   * Implements session management and error simulation
   */
  public handleGoogleCallback = jest.fn().mockImplementation(
    async (code: string, state: string): Promise<{ token: string; user: User }> => {
      if (!code || !state) {
        throw createHttpError(HTTP_STATUS_CODES.BAD_REQUEST, {
          code: 'AUTH003',
          message: AUTH_ERRORS.AUTH003
        });
      }

      const userSessions = this.activeSessions.get(mockUser.id) || [];

      // Check session limits
      if (userSessions.length >= this.maxSessions) {
        throw createHttpError(HTTP_STATUS_CODES.FORBIDDEN, {
          code: 'AUTH005',
          message: AUTH_ERRORS.AUTH005
        });
      }

      // Create new session
      const newSession: MockSessionData = {
        token: mockToken,
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date()
      };

      userSessions.push(newSession);
      this.activeSessions.set(mockUser.id, userSessions);

      return { token: mockToken, user: mockUser };
    }
  );

  /**
   * Mock token verification
   * Simulates session validation and token expiration
   */
  public verifyToken = jest.fn().mockImplementation(async (token: string): Promise<User> => {
    if (token !== mockToken) {
      throw createHttpError(HTTP_STATUS_CODES.UNAUTHORIZED, {
        code: 'AUTH001',
        message: AUTH_ERRORS.AUTH001
      });
    }

    const userSessions = this.activeSessions.get(mockUser.id) || [];
    const session = userSessions.find(s => s.token === token);

    if (!session) {
      throw createHttpError(HTTP_STATUS_CODES.UNAUTHORIZED, {
        code: 'AUTH004',
        message: AUTH_ERRORS.AUTH004
      });
    }

    // Check session expiration
    if (session.expiresAt < new Date()) {
      throw createHttpError(HTTP_STATUS_CODES.UNAUTHORIZED, {
        code: 'AUTH004',
        message: AUTH_ERRORS.AUTH004
      });
    }

    // Update last activity
    session.lastActivityAt = new Date();
    return mockUser;
  });

  /**
   * Mock token refresh
   * Implements session extension and validation
   */
  public refreshToken = jest.fn().mockImplementation(async (token: string): Promise<string> => {
    if (token !== mockToken) {
      throw createHttpError(HTTP_STATUS_CODES.UNAUTHORIZED, {
        code: 'AUTH001',
        message: AUTH_ERRORS.AUTH001
      });
    }

    const userSessions = this.activeSessions.get(mockUser.id) || [];
    const sessionIndex = userSessions.findIndex(s => s.token === token);

    if (sessionIndex === -1) {
      throw createHttpError(HTTP_STATUS_CODES.UNAUTHORIZED, {
        code: 'AUTH004',
        message: AUTH_ERRORS.AUTH004
      });
    }

    // Update session expiration
    userSessions[sessionIndex].expiresAt = new Date(Date.now() + 3600000);
    userSessions[sessionIndex].lastActivityAt = new Date();
    
    return mockToken;
  });

  /**
   * Helper method to clear mock data between tests
   */
  public clearMockData(): void {
    this.activeSessions.clear();
    this.requestCounts.clear();
    this.activeSessions.set(mockUser.id, [{
      token: mockToken,
      expiresAt: new Date(Date.now() + 3600000),
      lastActivityAt: new Date()
    }]);
  }
}

/**
 * Factory function to create preconfigured mock auth service
 */
export const createMockAuthService = (options?: { maxSessions?: number; rateLimit?: number }) => {
  return new MockAuthService(options);
};