import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material'; // @mui/material v5.0.0
import ReportGenerator from '../components/reports/ReportGenerator';
import ReportsList from '../components/reports/ReportsList';
import { useReport } from '../hooks/useReport';
import { IReport } from '../interfaces/report.interface';

// Styled components using MUI system
const PageContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  maxWidth: '100%',
  margin: '0 auto',
  [theme.breakpoints.up('lg')]: {
    maxWidth: theme.breakpoints.values.lg,
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
}));

const ContentSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  padding: theme.spacing(3),
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: theme.zIndex.modal,
}));

/**
 * ReportsPage Component
 * Main page component for report generation and management with enhanced accessibility
 */
const ReportsPage: React.FC = () => {
  // State management
  const [showGenerator, setShowGenerator] = useState(false);
  const { reports, loading, progress, error, generateReport, fetchReports } = useReport();

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle report generation completion
  const handleReportGenerated = useCallback(async (report: IReport) => {
    try {
      // Announce completion to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Report ${report.name} has been generated successfully`;
      document.body.appendChild(announcement);

      // Update UI state
      setShowGenerator(false);
      await fetchReports();

      // Cleanup announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    } catch (err) {
      console.error('Error handling report generation:', err);
    }
  }, [fetchReports]);

  // Toggle report generator visibility
  const toggleReportGenerator = useCallback(() => {
    setShowGenerator(prev => !prev);
    
    // Announce state change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = showGenerator 
      ? 'Closing report generator' 
      : 'Opening report generator';
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [showGenerator]);

  return (
    <PageContainer role="main" aria-label="Reports Management">
      <HeaderSection>
        <Typography variant="h4" component="h1">
          Reports
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={toggleReportGenerator}
          aria-expanded={showGenerator}
          aria-controls="report-generator-section"
        >
          {showGenerator ? 'Close Generator' : 'Generate New Report'}
        </Button>
      </HeaderSection>

      <ContentSection>
        {showGenerator && (
          <Box
            id="report-generator-section"
            role="region"
            aria-label="Report Generator"
          >
            <ReportGenerator
              onComplete={handleReportGenerated}
              accessibility={{
                announceProgress: true,
                enableKeyboardNavigation: true,
                highContrast: false
              }}
            />
          </Box>
        )}

        <Box
          role="region"
          aria-label="Reports List"
          position="relative"
        >
          <ReportsList />
          
          {loading && (
            <LoadingOverlay>
              <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                <CircularProgress size={40} />
                {progress > 0 && (
                  <Typography variant="body2" color="textSecondary">
                    {`Loading... ${progress}%`}
                  </Typography>
                )}
              </Box>
            </LoadingOverlay>
          )}
        </Box>

        {error && (
          <Box
            role="alert"
            aria-live="assertive"
            sx={{
              backgroundColor: theme => theme.palette.error.light,
              color: theme => theme.palette.error.main,
              padding: 2,
              borderRadius: 1,
              marginTop: 2
            }}
          >
            <Typography>
              {error.message || 'An error occurred while loading reports'}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={fetchReports}
              sx={{ mt: 1 }}
            >
              Retry
            </Button>
          </Box>
        )}
      </ContentSection>
    </PageContainer>
  );
};

export default ReportsPage;