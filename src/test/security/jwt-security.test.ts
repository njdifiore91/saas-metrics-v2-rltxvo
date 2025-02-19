import * as jwt from 'jsonwebtoken'; // v9.0.0
import { JWT_CONFIG, TokenPayload } from '../../backend/src/auth-service/src/config/jwt.config';
import { AuthService } from '../../backend/src/auth-service/src/services/auth.service';
import { AUTH_ERRORS } from '../../backend/src/shared/constants/error-codes';
import '@testing-library/jest-dom'; // v5.16.5

// Mock Redis client
const mockRedisClient = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn()
};

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock User Model
const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn()
};

describe('JWT Token Generation', () => {
  let authService: AuthService;
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    lastLogin: new Date()
  };

  beforeEach(() => {
    authService = new AuthService(mockUserModel, mockRedisClient as any, mockLogger as any);
    jest.clearAllMocks();
  });

  test('should generate token with RS256 algorithm', async () => {
    const sessionId = 'test-session-id';
    const token = await authService['generateToken'](testUser, sessionId);
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.alg).toBe('RS256');
  });

  test('should set token expiration to 1 hour', async () => {
    const sessionId = 'test-session-id';
    const token = await authService['generateToken'](testUser, sessionId);
    const decoded = jwt.decode(token) as any;
    
    const issuedAt = decoded.iat * 1000;
    const expiresAt = decoded.exp * 1000;
    const duration = expiresAt - issuedAt;

    expect(duration).toBe(3600000); // 1 hour in milliseconds
  });

  test('should include required claims in token payload', async () => {
    const sessionId = 'test-session-id';
    const token = await authService['generateToken'](testUser, sessionId);
    const decoded = jwt.decode(token) as TokenPayload;

    expect(decoded).toMatchObject({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
      sessionId,
      permissions: expect.any(Array)
    });
  });
});

describe('JWT Token Validation', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockUserModel, mockRedisClient as any, mockLogger as any);
    jest.clearAllMocks();
  });

  test('should validate valid tokens', async () => {
    const validToken = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256' }
    );

    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.get.mockResolvedValue(JSON.stringify({
      userId: 'test-id',
      sessionId: 'test-session',
      lastActivity: Date.now()
    }));

    await expect(authService.verifyToken(validToken)).resolves.not.toThrow();
  });

  test('should reject expired tokens', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256', expiresIn: '0s' }
    );

    await expect(authService.verifyToken(expiredToken))
      .rejects
      .toThrow(AUTH_ERRORS.AUTH001);
  });

  test('should detect invalid signatures', async () => {
    const invalidToken = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      'invalid-key',
      { algorithm: 'HS256' }
    );

    await expect(authService.verifyToken(invalidToken))
      .rejects
      .toThrow(AUTH_ERRORS.AUTH001);
  });

  test('should reject blacklisted tokens', async () => {
    const token = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256' }
    );

    mockRedisClient.exists.mockResolvedValue(1);

    await expect(authService.verifyToken(token))
      .rejects
      .toThrow(AUTH_ERRORS.AUTH001);
  });
});

describe('JWT Token Refresh', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockUserModel, mockRedisClient as any, mockLogger as any);
    jest.clearAllMocks();
  });

  test('should enforce maximum session limit', async () => {
    const userId = 'test-user-id';
    const sessions = Array(3).fill(null).map((_, i) => ({
      userId,
      sessionId: `session-${i}`,
      lastActivity: Date.now() - i * 1000
    }));

    mockRedisClient.keys.mockResolvedValue(
      sessions.map(s => `session:${s.userId}:${s.sessionId}`)
    );
    mockRedisClient.get.mockImplementation((key) => {
      const session = sessions.find(s => key.includes(s.sessionId));
      return Promise.resolve(session ? JSON.stringify(session) : null);
    });

    await authService['enforceSessionLimit'](userId);

    expect(mockRedisClient.del).toHaveBeenCalledWith(
      expect.stringContaining('session-2')
    );
  });

  test('should update session activity on token verification', async () => {
    const token = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256' }
    );

    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.get.mockResolvedValue(JSON.stringify({
      userId: 'test-id',
      sessionId: 'test-session',
      lastActivity: Date.now() - 1000
    }));

    await authService.verifyToken(token);

    expect(mockRedisClient.setex).toHaveBeenCalled();
  });
});

describe('JWT Security Controls', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockUserModel, mockRedisClient as any, mockLogger as any);
    jest.clearAllMocks();
  });

  test('should log authentication attempts', async () => {
    const token = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256' }
    );

    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.get.mockResolvedValue(JSON.stringify({
      userId: 'test-id',
      sessionId: 'test-session',
      lastActivity: Date.now()
    }));

    await authService.verifyToken(token);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Token verified successfully',
      expect.any(Object)
    );
  });

  test('should enforce session termination', async () => {
    const token = jwt.sign(
      { userId: 'test-id', sessionId: 'test-session' },
      JWT_CONFIG.privateKeyPath,
      { algorithm: 'RS256' }
    );

    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.get.mockResolvedValue(null);

    await expect(authService.verifyToken(token))
      .rejects
      .toThrow(AUTH_ERRORS.AUTH004);
  });
});

export namespace JWTSecurityTests {
  export const tokenGenerationTests = describe;
  export const tokenValidationTests = describe;
  export const tokenRefreshTests = describe;
  export const securityControlTests = describe;
}