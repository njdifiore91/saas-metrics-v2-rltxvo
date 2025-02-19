/**
 * Authentication Redux Slice
 * Manages global authentication state with enhanced security and session management
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, LoginRequest, GoogleOAuthRequest, AuthUser } from '../interfaces/auth.interface';
import { authService } from '../services/auth.service';
import { ERROR_CODES } from '../constants/api.constants';

// Initial authentication state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  sessionExpiry: null,
  sessionVersion: '1.0',
  concurrentSessions: 0
};

/**
 * Async thunk for user login with enhanced security
 */
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: any) {
      if (error.code === ERROR_CODES.AUTH.INVALID_CREDENTIALS) {
        return rejectWithValue('Invalid email or password');
      }
      return rejectWithValue('Authentication failed. Please try again.');
    }
  }
);

/**
 * Async thunk for Google OAuth authentication
 */
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (request: GoogleOAuthRequest, { rejectWithValue }) => {
    try {
      const response = await authService.googleLogin(request.code);
      return response;
    } catch (error: any) {
      if (error.code === ERROR_CODES.AUTH.INVALID_TOKEN) {
        return rejectWithValue('Invalid OAuth token');
      }
      return rejectWithValue('Google authentication failed');
    }
  }
);

/**
 * Async thunk for session refresh and token rotation
 */
export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { getState, rejectWithValue }) => {
    try {
      const response = await authService.refreshToken();
      return response;
    } catch (error: any) {
      if (error.code === ERROR_CODES.AUTH.TOKEN_EXPIRED) {
        return rejectWithValue('Session expired');
      }
      return rejectWithValue('Failed to refresh session');
    }
  }
);

/**
 * Async thunk for user logout with session cleanup
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error) {
      return rejectWithValue('Logout failed');
    }
  }
);

/**
 * Authentication slice with comprehensive state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionExpiry = null;
      state.error = null;
      state.concurrentSessions = 0;
    },
    setSessionExpiry: (state, action: PayloadAction<string>) => {
      state.sessionExpiry = action.payload;
    },
    updateSessionCount: (state, action: PayloadAction<number>) => {
      state.concurrentSessions = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.sessionExpiry = action.payload.expiresAt;
      state.loading = false;
      state.error = null;
      state.concurrentSessions++;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Google OAuth handling
    builder.addCase(googleLogin.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(googleLogin.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.sessionExpiry = action.payload.expiresAt;
      state.loading = false;
      state.error = null;
      state.concurrentSessions++;
    });
    builder.addCase(googleLogin.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Session refresh handling
    builder.addCase(refreshSession.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(refreshSession.fulfilled, (state, action) => {
      state.sessionExpiry = action.payload.expiresAt;
      state.loading = false;
      state.error = null;
    });
    builder.addCase(refreshSession.rejected, (state, action) => {
      state.isAuthenticated = false;
      state.user = null;
      state.sessionExpiry = null;
      state.loading = false;
      state.error = action.payload as string;
      state.concurrentSessions = 0;
    });

    // Logout handling
    builder.addCase(logout.fulfilled, (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.sessionExpiry = null;
      state.loading = false;
      state.error = null;
      state.concurrentSessions = 0;
    });
    builder.addCase(logout.rejected, (state, action) => {
      state.error = action.payload as string;
    });
  }
});

// Export actions and selectors
export const {
  setUser,
  clearAuth,
  setSessionExpiry,
  updateSessionCount,
  clearError
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectSessionStatus = (state: { auth: AuthState }) => ({
  expiry: state.auth.sessionExpiry,
  version: state.auth.sessionVersion,
  concurrentSessions: state.auth.concurrentSessions
});

export default authSlice.reducer;