import React, { useCallback, useState } from 'react';
import { GoogleIcon } from '@mui/icons-material'; // v5.0.0
import { Button, ButtonProps } from '../common/Button';
import { authService } from '../../services/auth.service';
import { authConfig } from '../../config/auth.config';
import { ApiError } from '../../types/api.types';

/**
 * Interface for successful authentication response
 */
interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
  token: string;
  refreshToken: string;
}

/**
 * Props interface for the GoogleAuthButton component
 */
interface GoogleAuthButtonProps extends Omit<ButtonProps, 'onClick'> {
  onSuccess: (response: AuthResponse) => void;
  onError: (error: ApiError) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * GoogleAuthButton Component
 * Implements Google OAuth authentication with enhanced security features
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  onError,
  className = '',
  disabled = false,
  ...buttonProps
}) => {
  const [loading, setLoading] = useState(false);

  /**
   * Opens Google OAuth popup window with secure parameters
   */
  const openOAuthPopup = useCallback((): Window | null => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const state = authConfig.oauth.state();
    const params = new URLSearchParams({
      client_id: authConfig.oauth.clientId,
      redirect_uri: authConfig.oauth.redirectUri,
      response_type: authConfig.oauth.responseType,
      scope: authConfig.oauth.scope.join(' '),
      state,
      prompt: authConfig.oauth.prompt,
      access_type: authConfig.oauth.accessType
    });

    return window.open(
      `${authConfig.oauth.endpoints.authorization}?${params.toString()}`,
      'Google OAuth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  }, []);

  /**
   * Handles the Google OAuth login flow with enhanced security
   */
  const handleGoogleLogin = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    
    if (loading || disabled) {
      return;
    }

    setLoading(true);
    let popup: Window | null = null;
    let messageListener: (event: MessageEvent) => void;

    try {
      popup = openOAuthPopup();
      if (!popup) {
        throw new Error('Failed to open OAuth popup. Please disable popup blocker.');
      }

      const authResult = await new Promise<{ code: string; state: string }>((resolve, reject) => {
        messageListener = (event: MessageEvent) => {
          // Validate origin for security
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data?.type === 'oauth_response') {
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve({
                code: event.data.code,
                state: event.data.state
              });
            }
          }
        };

        window.addEventListener('message', messageListener);

        // Set timeout for popup
        const checkPopupClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopupClosed);
            reject(new Error('Authentication cancelled'));
          }
        }, 1000);
      });

      // Validate state token to prevent CSRF attacks
      if (!authConfig.security.tokenSecurity.validateState(authResult.state)) {
        throw new Error('Invalid state token');
      }

      // Exchange code for tokens
      const response = await authService.googleLogin(authResult.code);
      onSuccess(response);
    } catch (error) {
      onError(error as ApiError);
    } finally {
      if (popup) {
        popup.close();
      }
      window.removeEventListener('message', messageListener!);
      setLoading(false);
    }
  }, [loading, disabled, onSuccess, onError, openOAuthPopup]);

  return (
    <Button
      variant="contained"
      color="primary"
      className={`google-auth-button ${className}`}
      onClick={handleGoogleLogin}
      disabled={disabled}
      loading={loading}
      startIcon={<GoogleIcon />}
      aria-label="Sign in with Google"
      {...buttonProps}
    >
      Sign in with Google
    </Button>
  );
};

/**
 * Export component props interface for external use
 */
export type { GoogleAuthButtonProps };

export default GoogleAuthButton;