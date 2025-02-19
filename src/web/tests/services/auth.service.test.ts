import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import MockAdapter from 'axios-mock-adapter'; // ^1.21.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { authService } from '../../src/services/auth.service';
import { authConfig } from '../../src/config/auth.config';
import { apiService } from '../../src/services/api.service';
import { API_ENDPOINTS } from '../../src/constants/api.constants';
import { UserRole } from '../../src/types/api.types';

// Mock axios instance
const mockAxios = new MockAdapter(apiService.axios);

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

// Mock CryptoJS functions
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn().mockReturnValue({ toString: () => 'encrypted_token' }),
    decrypt: jest.fn().mockReturnValue({ toString: () => 'decrypted_token' })
  },
  SHA256: jest.fn().mockReturnValue({ toString: () => 'hashed_key' }),
  enc: {
    Utf8: {}
  }
}));

// Mock window functions
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'location', { value: { href: '' } });

describe('AuthService', () => {
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    role: UserRole.USER,
    name: 'Test User'
  };

  const mockTokens = {
    token: 'valid_jwt_token',
    refreshToken: 'valid_refresh_token'
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    mockAxios.reset();
    jest.clearAllMocks();
    window.location.href = '';
  });

  describe('login', () => {
    const loginCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    test('should successfully login with valid credentials', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.LOGIN).reply(200, {
        user: mockUser,
        ...mockTokens
      });

      const response = await authService.login(loginCredentials);

      expect(response.user).toEqual(mockUser);
      expect(mockLocalStorage.getItem('encryptedToken')).toBeTruthy();
      expect(mockLocalStorage.getItem('encryptedRefreshToken')).toBeTruthy();
    });

    test('should handle invalid credentials', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.LOGIN).reply(401, {
        code: 'AUTH003',
        message: 'Invalid credentials'
      });

      await expect(authService.login(loginCredentials))
        .rejects.toThrow('Invalid credentials');
      expect(mockLocalStorage.getItem('encryptedToken')).toBeNull();
    });

    test('should enforce rate limiting on failed attempts', async () => {
      for (let i = 0; i < authConfig.security.rateLimiting.maxAttempts; i++) {
        mockAxios.onPost(API_ENDPOINTS.AUTH.LOGIN).reply(401);
        await expect(authService.login(loginCredentials)).rejects.toBeDefined();
      }

      mockAxios.onPost(API_ENDPOINTS.AUTH.LOGIN).reply(429, {
        code: 'SYS001',
        message: 'Rate limit exceeded'
      });

      await expect(authService.login(loginCredentials))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('googleLogin', () => {
    const mockCode = 'valid_oauth_code';
    const mockState = 'valid_state_token';

    beforeEach(() => {
      sessionStorage.setItem('oauth_state', mockState);
    });

    test('should complete Google OAuth flow successfully', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.GOOGLE).reply(200, {
        user: mockUser,
        ...mockTokens
      });

      const response = await authService.googleLogin(mockCode);

      expect(response.user).toEqual(mockUser);
      expect(mockLocalStorage.getItem('encryptedToken')).toBeTruthy();
      expect(mockLocalStorage.getItem('encryptedRefreshToken')).toBeTruthy();
    });

    test('should validate OAuth state parameter', async () => {
      sessionStorage.setItem('oauth_state', 'different_state');

      await expect(authService.googleLogin(mockCode))
        .rejects.toThrow('Invalid OAuth state');
    });

    test('should handle OAuth errors', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.GOOGLE).reply(400, {
        code: 'AUTH002',
        message: 'Invalid OAuth code'
      });

      await expect(authService.googleLogin(mockCode))
        .rejects.toThrow('Invalid OAuth code');
    });
  });

  describe('refreshSession', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('encryptedRefreshToken', 
        CryptoJS.AES.encrypt(mockTokens.refreshToken, 'key').toString());
    });

    test('should successfully refresh session', async () => {
      const newToken = 'new_jwt_token';
      mockAxios.onPost(API_ENDPOINTS.AUTH.REFRESH).reply(200, {
        user: mockUser,
        token: newToken,
        refreshToken: mockTokens.refreshToken
      });

      const token = await authService.refreshSession();

      expect(token).toBe(newToken);
      expect(mockLocalStorage.getItem('encryptedToken')).toBeTruthy();
    });

    test('should handle refresh token expiration', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.REFRESH).reply(401, {
        code: 'AUTH001',
        message: 'Refresh token expired'
      });

      await expect(authService.refreshSession())
        .rejects.toThrow('Refresh token expired');
      expect(mockLocalStorage.getItem('encryptedToken')).toBeNull();
      expect(mockLocalStorage.getItem('encryptedRefreshToken')).toBeNull();
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('encryptedToken', 
        CryptoJS.AES.encrypt(mockTokens.token, 'key').toString());
      mockLocalStorage.setItem('encryptedRefreshToken',
        CryptoJS.AES.encrypt(mockTokens.refreshToken, 'key').toString());
    });

    test('should successfully logout and clear session', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.LOGOUT).reply(200);

      await authService.logout();

      expect(mockLocalStorage.getItem('encryptedToken')).toBeNull();
      expect(mockLocalStorage.getItem('encryptedRefreshToken')).toBeNull();
    });

    test('should handle forced logout', async () => {
      mockAxios.onPost(API_ENDPOINTS.AUTH.LOGOUT).reply(401, {
        code: 'AUTH004',
        message: 'Session expired'
      });

      await authService.logout();

      expect(mockLocalStorage.getItem('encryptedToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('session management', () => {
    test('should validate current session', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        `eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImV4cCI6${
          Date.now() + 3600000
        }}`;
      
      mockLocalStorage.setItem('encryptedToken',
        CryptoJS.AES.encrypt(validToken, 'key').toString());

      expect(authService.validateSession()).toBe(true);
    });

    test('should handle concurrent sessions', async () => {
      const sessions = authConfig.session.maxConcurrentSessions + 1;
      
      for (let i = 0; i < sessions; i++) {
        mockAxios.onPost(API_ENDPOINTS.AUTH.LOGIN).reply(200, {
          user: { ...mockUser, id: `user_${i}` },
          ...mockTokens
        });
        
        await authService.login(loginCredentials);
      }

      // Verify only max allowed sessions are maintained
      expect(authService['activeSessions'].size)
        .toBe(authConfig.session.maxConcurrentSessions);
    });

    test('should handle session timeout', () => {
      jest.useFakeTimers();
      
      mockLocalStorage.setItem('encryptedToken',
        CryptoJS.AES.encrypt(mockTokens.token, 'key').toString());

      // Fast-forward past idle timeout
      jest.advanceTimersByTime(authConfig.session.idleTimeout * 1000 + 1000);

      expect(mockLocalStorage.getItem('encryptedToken')).toBeNull();
      expect(window.location.href).toBe('/login?timeout=true');

      jest.useRealTimers();
    });
  });
});