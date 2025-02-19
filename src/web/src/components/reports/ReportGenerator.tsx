import React, { useState, useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles'; // @mui/material v5.0.0
import { useMediaQuery, LinearProgress } from '@mui/material'; // @mui/material v5.0.0

import ReportConfigForm from '../forms/ReportConfigForm';
import ReportPreview from './ReportPreview';
import { reportService } from '../../services/report.service';
import ErrorBoundary from '../common/ErrorBoundary';
import { IReport, IReportConfig, ReportFormat } from '../../interfaces/report.interface';
import { ERROR_CODES, ERROR_MESSAGES } from '../../constants/error.constants';

// Styled components for layout and responsiveness
const ReportGeneratorContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
  height: '100%',
  position: 'relative',
}));

const ReportSection = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const ProgressContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  width: '100%',
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

// Custom error class for report generation
class ReportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReportError';
  }
}

// Props interface
interface ReportGeneratorProps {
  onComplete: (report: IReport) => void;
  initialConfig?: Partial<IReportConfig>;
  onError?: (error: ReportError) => void;
  accessibility?: {
    announceProgress: boolean;
    enableKeyboardNavigation: boolean;
    highContrast: boolean;
  };
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  onComplete,
  initialConfig,
  onError,
  accessibility = {
    announceProgress: true,
    enableKeyboardNavigation: true,
    highContrast: false,
  },
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedReport, setGeneratedReport] = useState<IReport | null>(null);
  const [error, setError] = useState<ReportError | null>(null);

  // Responsive layout handling
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('sm'));

  // Progress announcement for screen readers
  useEffect(() => {
    if (accessibility.announceProgress && loading && progress > 0) {
      const announcement = `Report generation ${progress}% complete`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.innerText = announcement;
      document.body.appendChild(ariaLive);
      
      return () => {
        document.body.removeChild(ariaLive);
      };
    }
  }, [progress, loading, accessibility.announceProgress]);

  // Handle config submission and report generation
  const handleConfigSubmit = useCallback(async (config: IReportConfig) => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Validate configuration
      if (!config.selectedMetrics.length) {
        throw new ReportError(
          ERROR_MESSAGES.DATA[ERROR_CODES.DATA.MISSING_FIELD],
          ERROR_CODES.DATA.MISSING_FIELD,
          { field: 'selectedMetrics' }
        );
      }

      // Generate report with progress tracking
      const report = await reportService.generateReport(config);
      
      // Update progress as generation proceeds
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const next = Math.min(prev + 10, 90);
          return next;
        });
      }, 500);

      // Clear interval and set final state
      clearInterval(progressInterval);
      setProgress(100);
      setGeneratedReport(report);
      onComplete(report);

    } catch (err) {
      const reportError = err instanceof ReportError 
        ? err 
        : new ReportError(
            ERROR_MESSAGES.API[ERROR_CODES.API.RESPONSE_ERROR],
            ERROR_CODES.API.RESPONSE_ERROR,
            { originalError: err }
          );
      
      setError(reportError);
      onError?.(reportError);
    } finally {
      setLoading(false);
    }
  }, [onComplete, onError]);

  // Handle report export
  const handleExport = useCallback(async (reportId: string, format: ReportFormat) => {
    try {
      await reportService.exportReport(reportId, format);
    } catch (err) {
      const exportError = new ReportError(
        ERROR_MESSAGES.API[ERROR_CODES.API.RESPONSE_ERROR],
        ERROR_CODES.API.RESPONSE_ERROR,
        { context: 'export', originalError: err }
      );
      setError(exportError);
      onError?.(exportError);
    }
  }, [onError]);

  return (
    <ErrorBoundary
      onError={(error) => {
        const boundaryError = new ReportError(
          error.message,
          ERROR_CODES.SYS.SERVICE_UNAVAILABLE,
          { context: 'boundary', originalError: error }
        );
        onError?.(boundaryError);
      }}
    >
      <ReportGeneratorContainer
        role="main"
        aria-label="Report Generator"
      >
        <ReportSection aria-label="Report Configuration">
          <ReportConfigForm
            onSubmit={handleConfigSubmit}
            initialConfig={initialConfig}
            onProgress={setProgress}
          />
          
          {loading && (
            <ProgressContainer role="progressbar" aria-valuenow={progress}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme => 
                    accessibility.highContrast 
                      ? theme.palette.grey[300]
                      : theme.palette.grey[100],
                }}
              />
            </ProgressContainer>
          )}
        </ReportSection>

        {generatedReport && (
          <ReportSection aria-label="Report Preview">
            <ReportPreview
              report={generatedReport}
              onExport={handleExport}
              isLoading={loading}
              error={error}
            />
          </ReportSection>
        )}
      </ReportGeneratorContainer>
    </ErrorBoundary>
  );
};

export default ReportGenerator;