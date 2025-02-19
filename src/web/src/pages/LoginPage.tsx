import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import LoginForm from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../types/api.types';
import { authConfig } from '../config/auth.config';

// Styled components for layout and accessibility
const LoginContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',

  '@media (max-width: 600px)': {
    padding: theme.spacing(2),
  },
}));

const LoginCard = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: '480px',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  padding: theme.spacing(4),
  position: 'relative',
  zIndex: 1,

  '&:focus-within': {
    boxShadow: theme.shadows[8],
  },

  '@media (max-width: 600px)': {
    padding: theme.spacing(3),
    boxShadow: 'none',
  },
}));

const LoginTitle = styled('h1')(({ theme }) => ({
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(4),
  textAlign: 'center',
  fontSize: '2rem',
  fontWeight: 600,

  '@media (max-width: 600px)': {
    fontSize: '1.75rem',
    marginBottom: theme.spacing(3),
  },
}));

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login, loginWithGoogle, refreshToken } = useAuth();
  const [rateLimitCounter, setRateLimitCounter] = useState<number>(0);
  const [rateLimitTimeout, setRateLimitTimeout] = useState<boolean>(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Handle successful login
  const handleLoginSuccess = useCallback(
    async (response: { user: any; token: string }) => {
      try {
        await login({
          email: response.user.email,
          password: '', // Password is not stored
          rememberMe: true,
        });
        navigate('/dashboard');
      } catch (error) {
        console.error('Login success handler error:', error);
      }
    },
    [login, navigate]
  );

  // Handle login errors with rate limiting
  const handleLoginError = useCallback(
    (error: ApiError) => {
      if (error.code === 'SYS001') {
        // Rate limit exceeded
        setRateLimitTimeout(true);
        setTimeout(() => {
          setRateLimitTimeout(false);
          setRateLimitCounter(0);
        }, authConfig.security.rateLimiting.windowMs);
      } else {
        // Increment rate limit counter
        setRateLimitCounter((prev) => {
          const newCount = prev + 1;
          if (newCount >= authConfig.security.rateLimiting.maxAttempts) {
            setRateLimitTimeout(true);
            setTimeout(() => {
              setRateLimitTimeout(false);
              return 0;
            }, authConfig.security.rateLimiting.windowMs);
          }
          return newCount;
        });
      }
    },
    []
  );

  // Handle rate limit reached
  const handleRateLimit = useCallback((retryAfter: number) => {
    setRateLimitTimeout(true);
    setTimeout(() => {
      setRateLimitTimeout(false);
      setRateLimitCounter(0);
    }, retryAfter * 1000);
  }, []);

  // Handle session expiry
  useEffect(() => {
    const checkSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('timeout') === 'true') {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Session refresh error:', error);
        }
      }
    };
    checkSession();
  }, [refreshToken]);

  return (
    <LoginContainer>
      <LoginCard role="main" aria-labelledby="login-title">
        <LoginTitle id="login-title">Sign in to Startup Metrics</LoginTitle>
        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          onRateLimit={handleRateLimit}
          disabled={rateLimitTimeout}
        />
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;