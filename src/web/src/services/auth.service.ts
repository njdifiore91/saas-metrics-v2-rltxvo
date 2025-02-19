/**
 * Enhanced Authentication Service
 * Handles all authentication operations with secure token management and session tracking
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { authConfig } from '../config/auth.config';
import jwtDecode from 'jwt-decode'; // ^3.1.2
import CryptoJS from 'crypto-js'; // ^4.1.1
import { UserRole, ApiResponse } from '../types/api.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Types for authentication
interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
}

interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
}

class AuthService {
  private currentToken: string | null = null;
  private refreshToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private readonly activeSessions: Map<string, number> = new Map();
  private tokenRotationInterval: number | null = null;
  private sessionTimeout: number | null = null;
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
    this.initializeAuth();
    this.setupStorageListener();
    this.startSessionMonitoring();
  }

  /**
   * Initializes authentication state from secure storage
   */
  private initializeAuth(): void {
    const encryptedToken = localStorage.getItem('encryptedToken');
    const encryptedRefreshToken = localStorage.getItem('encryptedRefreshToken');

    if (encryptedToken && encryptedRefreshToken) {
      try {
        this.currentToken = this.decryptToken(encryptedToken);
        this.refreshToken = this.decryptToken(encryptedRefreshToken);
        this.currentUser = this.parseToken(this.currentToken);
        this.scheduleTokenRotation();
      } catch (error) {
        this.clearAuth();
      }
    }
  }

  /**
   * Authenticates user with email/password
   */
  public async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      await this.handleAuthSuccess(response.data);
      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handles Google OAuth authentication
   */
  public async googleLogin(code: string): Promise<AuthResponse> {
    if (!authConfig.security.tokenSecurity.validateState(sessionStorage.getItem('oauth_state') || '')) {
      throw new Error('Invalid OAuth state');
    }

    try {
      const response = await apiService.post<AuthResponse>(
        API_ENDPOINTS.AUTH.GOOGLE,
        { code }
      );

      await this.handleAuthSuccess(response.data);
      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Refreshes the current session
   */
  public async refreshSession(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiService.post<AuthResponse>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken: this.refreshToken }
      );

      await this.handleAuthSuccess(response.data);
      return response.data.token;
    } catch (error) {
      this.clearAuth();
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logs out the current user
   */
  public async logout(): Promise<void> {
    try {
      if (this.currentToken) {
        await apiService.post(API_ENDPOINTS.AUTH.LOGOUT);
      }
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Returns the current authenticated user
   */
  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Validates the current session
   */
  public validateSession(): boolean {
    if (!this.currentToken || !this.currentUser) {
      return false;
    }

    try {
      const payload = jwtDecode<TokenPayload>(this.currentToken);
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Handles successful authentication
   */
  private async handleAuthSuccess(authResponse: AuthResponse): Promise<void> {
    this.currentToken = authResponse.token;
    this.refreshToken = authResponse.refreshToken;
    this.currentUser = authResponse.user;

    // Encrypt tokens before storage
    const encryptedToken = this.encryptToken(authResponse.token);
    const encryptedRefreshToken = this.encryptToken(authResponse.refreshToken);

    localStorage.setItem('encryptedToken', encryptedToken);
    localStorage.setItem('encryptedRefreshToken', encryptedRefreshToken);

    this.trackSession();
    this.scheduleTokenRotation();
  }

  /**
   * Tracks active sessions
   */
  private trackSession(): void {
    if (this.currentUser) {
      const activeSessions = this.activeSessions.size;
      if (activeSessions >= authConfig.session.maxConcurrentSessions) {
        // Remove oldest session
        const oldestSession = Array.from(this.activeSessions.entries())
          .sort(([, a], [, b]) => a - b)[0];
        if (oldestSession) {
          this.activeSessions.delete(oldestSession[0]);
        }
      }
      this.activeSessions.set(this.currentUser.id, Date.now());
    }
  }

  /**
   * Schedules token rotation for security
   */
  private scheduleTokenRotation(): void {
    if (this.tokenRotationInterval) {
      clearInterval(this.tokenRotationInterval);
    }

    // Rotate token 5 minutes before expiry
    const rotationTime = (authConfig.jwt.expiresIn - 300) * 1000;
    this.tokenRotationInterval = window.setInterval(
      () => this.refreshSession(),
      rotationTime
    );
  }

  /**
   * Starts session monitoring
   */
  private startSessionMonitoring(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = window.setTimeout(
      () => this.handleSessionTimeout(),
      authConfig.session.idleTimeout * 1000
    );
  }

  /**
   * Handles session timeout
   */
  private handleSessionTimeout(): void {
    this.clearAuth();
    window.location.href = '/login?timeout=true';
  }

  /**
   * Generates encryption key for token storage
   */
  private generateEncryptionKey(): string {
    const browserKey = navigator.userAgent + window.screen.height + window.screen.width;
    return CryptoJS.SHA256(browserKey).toString();
  }

  /**
   * Encrypts token for secure storage
   */
  private encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
  }

  /**
   * Decrypts token from secure storage
   */
  private decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Parses JWT token
   */
  private parseToken(token: string): AuthUser {
    const payload = jwtDecode<TokenPayload>(token);
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.email.split('@')[0] // Temporary name from email
    };
  }

  /**
   * Clears authentication state
   */
  private clearAuth(): void {
    this.currentToken = null;
    this.refreshToken = null;
    this.currentUser = null;
    localStorage.removeItem('encryptedToken');
    localStorage.removeItem('encryptedRefreshToken');

    if (this.tokenRotationInterval) {
      clearInterval(this.tokenRotationInterval);
    }
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
  }

  /**
   * Sets up storage event listener for multi-tab synchronization
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === 'encryptedToken' && !event.newValue) {
        this.clearAuth();
        window.location.href = '/login';
      }
    });
  }

  /**
   * Handles authentication errors
   */
  private handleAuthError(error: any): Error {
    if (error.code === 'AUTH001' || error.code === 'AUTH002') {
      this.clearAuth();
    }
    return error;
  }
}

// Export singleton instance
export const authService = new AuthService();