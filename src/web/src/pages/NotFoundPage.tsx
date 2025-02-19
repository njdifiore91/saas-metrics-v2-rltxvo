import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { Box, Typography } from '@mui/material'; // v5.0.0
import MainLayout from '../components/layout/MainLayout';
import Button from '../components/common/Button';

/**
 * NotFoundPage component that displays when users navigate to non-existent routes
 * Provides user-friendly error message and clear navigation options
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  /**
   * Handles navigation back to home page
   */
  const handleNavigateHome = useCallback(() => {
    // Log 404 recovery attempt for analytics
    console.info('User redirected from 404 page to home');
    navigate('/');
  }, [navigate]);

  return (
    <MainLayout
      initialSidebarOpen={false}
      testId="not-found-page"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 128px)', // Account for header and footer
          padding: {
            xs: '16px',
            sm: '24px',
            md: '32px'
          }
        }}
        role="main"
        aria-label="Page Not Found"
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: {
              xs: '32px',
              sm: '48px'
            },
            fontWeight: 'bold',
            marginBottom: '16px',
            color: 'text.primary',
            textAlign: 'center'
          }}
          aria-label="404 - Page Not Found"
        >
          404 - Page Not Found
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: {
              xs: '16px',
              sm: '18px'
            },
            marginBottom: '32px',
            color: 'text.secondary',
            textAlign: 'center',
            maxWidth: '600px'
          }}
          aria-label="The page you're looking for doesn't exist"
        >
          We couldn't find the page you're looking for. It might have been moved, deleted,
          or never existed. Please check the URL or return to the home page.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={handleNavigateHome}
          aria-label="Return to Home Page"
          sx={{
            marginTop: '24px',
            transition: 'all 0.2s ease-in-out',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px'
            }
          }}
        >
          Return to Home Page
        </Button>
      </Box>
    </MainLayout>
  );
};

export default NotFoundPage;