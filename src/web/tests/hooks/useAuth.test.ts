/**
 * Test suite for useAuth hook
 * Verifies authentication, session management, and security features
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import jwtDecode from 'jwt-decode'; // v3.1.2
import { useAuth } from '../../src/hooks/useAuth';
import { AuthUser } from '../../src/interfaces/auth.interface';
import { UserRole } from '../../src/types/api.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Test utilities
const setupTest = () => {
  // Create mock store
  const store = configureStore({
    reducer: {
      auth: (state = {
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
        sessionExpiry: null,
      }, action) => {
        switch (action.type) {
          case 'AUTH_LOGIN_SUCCESS':
            return {
              ...state,
              isAuthenticated: true,
              user: action.payload.user,
              loading: false,
              sessionExpiry: action.payload.sessionExpiry,
            };
          case 'AUTH_LOGOUT':
            return {
              ...state,
              isAuthenticated: false,
              user: null,
              sessionExpiry: null,
            };
          default:
            return state;
        }
      },
    },
  });

  // Create wrapper with store provider
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper,
  };
};

// Mock token generator
const mockToken = (data: Partial<AuthUser>) => {
  const token = {
    sub: data.id || 'test-user-id',
    email: data.email || 'test@example.com',
    role: data.role || UserRole.USER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  return Buffer.from(JSON.stringify(token)).toString('base64');
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Login Functionality', () => {
    it('should handle successful login with credentials', async () => {
      const { wrapper } = setupTest();
      const mockUser: AuthUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
        token: mockToken({ id: 'test-id', role: UserRole.USER }),
        refreshToken: 'refresh-token',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        sessionId: 'test-session',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: mockUser,
          token: mockToken(mockUser),
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true,
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('deviceId', expect.any(String));
    });

    it('should handle Google OAuth login', async () => {
      const { wrapper } = setupTest();
      mockSessionStorage.getItem.mockReturnValue('valid-state');

      const mockUser: AuthUser = {
        id: 'google-id',
        email: 'google@example.com',
        name: 'Google User',
        role: UserRole.USER,
        token: mockToken({ id: 'google-id', role: UserRole.USER }),
        refreshToken: 'google-refresh-token',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        sessionId: 'google-session',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: mockUser,
          token: mockToken(mockUser),
          refreshToken: 'google-refresh-token',
          expiresIn: 3600,
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.loginWithGoogle('auth-code', 'valid-state');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('Session Management', () => {
    it('should handle token refresh correctly', async () => {
      const { wrapper } = setupTest();
      const mockUser: AuthUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
        token: mockToken({ id: 'test-id', role: UserRole.USER }),
        refreshToken: 'refresh-token',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        sessionId: 'test-session',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          token: mockToken(mockUser),
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.any(Object));
    });

    it('should handle session expiration', async () => {
      const { wrapper } = setupTest();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Session expired' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should validate user permissions correctly', () => {
      const { wrapper } = setupTest();
      const mockUser: AuthUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        token: mockToken({ id: 'admin-id', role: UserRole.ADMIN }),
        refreshToken: 'admin-refresh-token',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        sessionId: 'admin-session',
      };

      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login({
          email: 'admin@example.com',
          password: 'admin123',
          rememberMe: false,
        });
      });

      expect(result.current.hasRole(UserRole.ADMIN)).toBe(true);
      expect(result.current.hasRole(UserRole.USER)).toBe(true);
      expect(result.current.hasRole(UserRole.GUEST)).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should handle secure logout', async () => {
      const { wrapper } = setupTest();
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/logout', expect.any(Object));
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('deviceId');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should validate token integrity', async () => {
      const { wrapper } = setupTest();
      const invalidToken = 'invalid-token';
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid token' }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});