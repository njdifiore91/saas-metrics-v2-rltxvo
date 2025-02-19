import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // v7.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import Input from '../common/Input';
import GoogleAuthButton from './GoogleAuthButton';
import { authService } from '../../services/auth.service';
import { ApiError } from '../../types/api.types';

// Styled components for form layout
const FormContainer = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  maxWidth: '400px',
  margin: '0 auto',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
}));

const ErrorMessage = styled('div')(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: '0.875rem',
  marginTop: theme.spacing(1),
  padding: theme.spacing(1),
  backgroundColor: `${theme.palette.error.light}20`,
  borderRadius: theme.shape.borderRadius,
  textAlign: 'center',
}));

// Interface for form data
interface LoginFormData {
  email: string;
  password: string;
  csrfToken: string;
}

// Props interface for the LoginForm component
export interface LoginFormProps {
  onSuccess: (response: { user: any; token: string }) => void;
  onError: (error: ApiError) => void;
  onRateLimit?: (retryAfter: number) => void;
}

// Email validation pattern
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  onRateLimit,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginFormData>();

  // Initialize CSRF token
  useEffect(() => {
    const initializeCsrf = async () => {
      try {
        const token = await authService.generateCsrfToken();
        setCsrfToken(token);
      } catch (error) {
        onError(error as ApiError);
      }
    };
    initializeCsrf();
  }, [onError]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        // Validate CSRF token
        if (data.csrfToken !== csrfToken) {
          throw new Error('Invalid security token');
        }

        const response = await authService.login({
          email: data.email,
          password: data.password,
        });

        onSuccess(response);
        reset();
      } catch (error) {
        const apiError = error as ApiError;
        
        if (apiError.code === 'SYS001' && onRateLimit) {
          const retryAfter = parseInt(apiError.details?.retryAfter as string || '30');
          onRateLimit(retryAfter);
        } else {
          setError(apiError.message);
          onError(apiError);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, csrfToken, onSuccess, onError, onRateLimit, reset]
  );

  // Handle Google OAuth success
  const handleGoogleSuccess = useCallback(
    async (response: { user: any; token: string }) => {
      setError(null);
      onSuccess(response);
    },
    [onSuccess]
  );

  // Handle Google OAuth error
  const handleGoogleError = useCallback(
    (error: ApiError) => {
      setError(error.message);
      onError(error);
    },
    [onError]
  );

  return (
    <FormContainer onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register('csrfToken')} value={csrfToken} />
      
      <Input
        id="email"
        label="Email Address"
        type="email"
        error={!!errors.email}
        helperText={errors.email?.message}
        disabled={loading}
        required
        {...register('email', {
          required: 'Email is required',
          pattern: {
            value: EMAIL_PATTERN,
            message: 'Please enter a valid email address',
          },
        })}
        ariaLabel="Email Address"
      />

      <Input
        id="password"
        label="Password"
        type="password"
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={loading}
        required
        {...register('password', {
          required: 'Password is required',
          minLength: {
            value: 12,
            message: 'Password must be at least 12 characters',
          },
        })}
        ariaLabel="Password"
      />

      {error && (
        <ErrorMessage role="alert" aria-live="polite">
          {error}
        </ErrorMessage>
      )}

      <GoogleAuthButton
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        disabled={loading}
      />
    </FormContainer>
  );
};

export default LoginForm;