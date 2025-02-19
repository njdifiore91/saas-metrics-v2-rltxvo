import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toHaveNoViolations } from 'jest-axe';
import { describe, test, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import LoginForm, { LoginFormProps } from '../../src/components/auth/LoginForm';
import { createMockAuthService, mockUser, mockToken } from '../../../test/mocks/auth-service.mock';
import { ApiError } from '../../src/types/api.types';
import { ERROR_CODES } from '../../src/constants/api.constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../src/services/auth.service');
const mockAuthService = createMockAuthService();

// Test utilities
const renderLoginForm = (props: Partial<LoginFormProps> = {}) => {
  const defaultProps: LoginFormProps = {
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onRateLimit: jest.fn(),
    ...props
  };
  return render(<LoginForm {...defaultProps} />);
};

describe('LoginForm Component', () => {
  // Setup before all tests
  beforeAll(() => {
    // Configure test environment
    window.crypto = {
      ...window.crypto,
      subtle: {
        ...window.crypto.subtle,
        digest: jest.fn()
      }
    };
  });

  // Setup before each test
  beforeEach(() => {
    // Reset mocks and auth service
    jest.clearAllMocks();
    mockAuthService.clearMockData();
    // Set up CSRF token
    localStorage.clear();
    sessionStorage.clear();
  });

  // Cleanup after each test
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Rendering and Accessibility', () => {
    test('renders form elements with proper accessibility attributes', async () => {
      const { container } = renderLoginForm();

      // Check form elements
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();

      // Verify ARIA attributes
      expect(screen.getByRole('form')).toHaveAttribute('novalidate');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true');

      // Check accessibility
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('shows loading state during authentication', async () => {
      renderLoginForm();
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.click(submitButton);
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('validates email format', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email/i);

      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    test('validates password requirements', async () => {
      renderLoginForm();
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(passwordInput, 'short');
      fireEvent.blur(passwordInput);

      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    test('handles successful email/password login', async () => {
      const onSuccess = jest.fn();
      renderLoginForm({ onSuccess });

      // Fill form
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'securePassword123!');
      
      // Submit form
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          user: mockUser,
          token: mockToken
        });
      });
    });

    test('handles Google OAuth authentication', async () => {
      const onSuccess = jest.fn();
      renderLoginForm({ onSuccess });

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockAuthService.initiateGoogleAuth).toHaveBeenCalled();
      });
    });

    test('handles rate limiting', async () => {
      const onRateLimit = jest.fn();
      renderLoginForm({ onRateLimit });

      // Trigger rate limit
      mockAuthService.initiateGoogleAuth.mockRejectedValueOnce({
        code: ERROR_CODES.SYS.RATE_LIMIT,
        message: 'Rate limit exceeded',
        details: { retryAfter: '30' }
      });

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(onRateLimit).toHaveBeenCalledWith(30);
      });
    });
  });

  describe('Security Measures', () => {
    test('includes CSRF token in form submission', async () => {
      const { container } = renderLoginForm();
      const csrfToken = container.querySelector('input[name="csrfToken"]');
      
      expect(csrfToken).toHaveAttribute('type', 'hidden');
      expect(csrfToken).toHaveValue(expect.any(String));
    });

    test('sanitizes error messages', async () => {
      const onError = jest.fn();
      renderLoginForm({ onError });

      // Mock malicious error message
      mockAuthService.initiateGoogleAuth.mockRejectedValueOnce({
        message: '<script>alert("xss")</script>Error occurred'
      });

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage.innerHTML).not.toContain('<script>');
      });
    });
  });

  describe('Error Handling', () => {
    test('displays authentication errors', async () => {
      renderLoginForm();

      // Mock auth error
      mockAuthService.initiateGoogleAuth.mockRejectedValueOnce({
        code: ERROR_CODES.AUTH.INVALID_CREDENTIALS,
        message: 'Invalid credentials'
      });

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
      });
    });

    test('handles network errors gracefully', async () => {
      const onError = jest.fn();
      renderLoginForm({ onError });

      // Mock network error
      mockAuthService.initiateGoogleAuth.mockRejectedValueOnce(new Error('Network error'));

      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});