import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import GoogleAuthButton, { GoogleAuthButtonProps } from '../../../../src/components/auth/GoogleAuthButton';
import { authService } from '../../../../src/services/auth.service';
import { authConfig } from '../../../../src/config/auth.config';
import { ApiError } from '../../../../src/types/api.types';

// Mock window.open for OAuth popup
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

// Mock authService
vi.mock('../../../../src/services/auth.service', () => ({
  authService: {
    googleLogin: vi.fn()
  }
}));

// Mock authConfig
vi.mock('../../../../src/config/auth.config', () => ({
  authConfig: {
    oauth: {
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:3000/auth/callback',
      scope: ['email', 'profile'],
      responseType: 'code',
      prompt: 'select_account',
      accessType: 'offline',
      state: vi.fn().mockReturnValue('test-state-token'),
      endpoints: {
        authorization: 'https://accounts.google.com/o/oauth2/v2/auth'
      }
    },
    security: {
      tokenSecurity: {
        validateState: vi.fn()
      }
    }
  }
}));

describe('GoogleAuthButton', () => {
  const mockSuccessCallback = vi.fn();
  const mockErrorCallback = vi.fn();
  let defaultProps: GoogleAuthButtonProps;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Setup default props
    defaultProps = {
      onSuccess: mockSuccessCallback,
      onError: mockErrorCallback,
      className: 'custom-class'
    };

    // Reset window event listeners
    window.removeEventListener = vi.fn();
    window.addEventListener = vi.fn();
  });

  test('renders correctly', () => {
    render(<GoogleAuthButton {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('google-auth-button', 'custom-class');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Sign in with Google');
    
    const googleIcon = screen.getByTestId('GoogleIcon');
    expect(googleIcon).toBeInTheDocument();
  });

  test('handles successful login flow', async () => {
    const mockAuthResponse = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
        name: 'Test User'
      },
      token: 'test-token',
      refreshToken: 'test-refresh-token'
    };

    // Mock successful OAuth popup response
    const mockPopup = {
      closed: false,
      close: vi.fn()
    };
    mockWindowOpen.mockReturnValue(mockPopup);

    // Mock successful state validation
    authConfig.security.tokenSecurity.validateState.mockReturnValue(true);

    // Mock successful authentication
    (authService.googleLogin as jest.Mock).mockResolvedValue(mockAuthResponse);

    render(<GoogleAuthButton {...defaultProps} />);
    
    // Click the button to initiate OAuth flow
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Verify popup was opened with correct parameters
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
      'Google OAuth',
      expect.stringContaining('width=500,height=600')
    );

    // Simulate OAuth callback message
    const messageEventListener = (window.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'message'
    )[1];

    messageEventListener({
      origin: window.location.origin,
      data: {
        type: 'oauth_response',
        code: 'test-auth-code',
        state: 'test-state-token'
      }
    });

    await waitFor(() => {
      // Verify authentication service was called
      expect(authService.googleLogin).toHaveBeenCalledWith('test-auth-code');
      
      // Verify success callback was called with response
      expect(mockSuccessCallback).toHaveBeenCalledWith(mockAuthResponse);
      
      // Verify popup was closed
      expect(mockPopup.close).toHaveBeenCalled();
      
      // Verify event listener was removed
      expect(window.removeEventListener).toHaveBeenCalled();
    });
  });

  test('handles login errors appropriately', async () => {
    // Mock popup blocker scenario
    mockWindowOpen.mockReturnValue(null);

    render(<GoogleAuthButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to open OAuth popup. Please disable popup blocker.'
        })
      );
    });

    // Mock invalid state token
    mockWindowOpen.mockReturnValue({ closed: false, close: vi.fn() });
    authConfig.security.tokenSecurity.validateState.mockReturnValue(false);

    fireEvent.click(button);

    const messageEventListener = (window.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'message'
    )[1];

    messageEventListener({
      origin: window.location.origin,
      data: {
        type: 'oauth_response',
        code: 'test-auth-code',
        state: 'invalid-state'
      }
    });

    await waitFor(() => {
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid state token'
        })
      );
    });

    // Mock API error
    const apiError: ApiError = {
      code: 'AUTH001',
      message: 'Authentication failed',
      details: { reason: 'Invalid token' }
    };
    
    (authService.googleLogin as jest.Mock).mockRejectedValue(apiError);

    messageEventListener({
      origin: window.location.origin,
      data: {
        type: 'oauth_response',
        code: 'test-auth-code',
        state: 'test-state-token'
      }
    });

    await waitFor(() => {
      expect(mockErrorCallback).toHaveBeenCalledWith(apiError);
    });
  });

  test('handles loading states correctly', async () => {
    // Mock long-running authentication
    (authService.googleLogin as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<GoogleAuthButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Verify button is disabled during authentication
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Verify loading indicator is shown
    const loadingIndicator = screen.getByRole('progressbar');
    expect(loadingIndicator).toBeInTheDocument();

    // Verify button text is visually hidden but accessible
    const buttonText = screen.getByText('Sign in with Google');
    expect(buttonText).toHaveStyle({ visibility: 'hidden' });

    // Verify second click is prevented during loading
    fireEvent.click(button);
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
  });

  test('handles disabled state', () => {
    render(<GoogleAuthButton {...defaultProps} disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(button);
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  test('handles popup closed by user', async () => {
    const mockPopup = {
      closed: true,
      close: vi.fn()
    };
    mockWindowOpen.mockReturnValue(mockPopup);

    render(<GoogleAuthButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait for popup closed check
    await waitFor(() => {
      expect(mockErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication cancelled'
        })
      );
    });
  });
});