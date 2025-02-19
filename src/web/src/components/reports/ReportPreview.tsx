import React, { useState, useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import CircularProgress from '@mui/material/CircularProgress';
import Card from '../common/Card';
import { IReport, ReportFormat } from '../../interfaces/report.interface';
import { reportService } from '../../services/report.service';

// Enhanced props interface for the ReportPreview component
interface ReportPreviewProps {
  report: IReport;
  onExport?: (reportId: string, format: ReportFormat) => Promise<void>;
  className?: string;
  isLoading?: boolean;
  error?: Error;
}

// Styled components with theme integration and responsive design
const PreviewContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  width: '100%',
  height: '100%',
  overflow: 'auto',
  position: 'relative',
  '@media (max-width: ${theme.breakpoints.values.sm}px)': {
    gap: theme.spacing(1),
  },
}));

const PreviewHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '@media (max-width: ${theme.breakpoints.values.sm}px)': {
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
}));

const PreviewContent = styled('div')(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(2),
  overflow: 'auto',
  position: 'relative',
  WebkitOverflowScrolling: 'touch',
}));

const PreviewTitle = styled('h2')(({ theme }) => ({
  ...theme.typography.h3,
  margin: 0,
  color: theme.palette.text.primary,
}));

const ErrorMessage = styled('div')(({ theme }) => ({
  color: theme.palette.error.main,
  padding: theme.spacing(2),
  textAlign: 'center',
}));

/**
 * ReportPreview Component
 * Provides an interactive preview of generated reports with export capabilities
 * Implements accessibility features and performance optimizations
 */
export const ReportPreview: React.FC<ReportPreviewProps> = ({
  report,
  onExport,
  className,
  isLoading = false,
  error,
}) => {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);

  // Reset error state when report changes
  useEffect(() => {
    setExportError(null);
  }, [report.id]);

  // Enhanced export handler with progress tracking and error handling
  const handleExport = useCallback(async (format: ReportFormat) => {
    if (exportLoading) return;

    setExportLoading(true);
    setExportError(null);

    try {
      if (onExport) {
        await onExport(report.id, format);
      } else {
        await reportService.exportReport(report.id, format);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error : new Error('Export failed'));
      console.error('Report export failed:', error);
    } finally {
      setExportLoading(false);
    }
  }, [report.id, onExport, exportLoading]);

  // Keyboard event handler for accessibility
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleExport(report.config.format);
    }
  }, [handleExport, report.config.format]);

  // Render error state
  if (error || exportError) {
    return (
      <Card className={className}>
        <ErrorMessage>
          {error?.message || exportError?.message || 'An error occurred'}
        </ErrorMessage>
      </Card>
    );
  }

  return (
    <Card 
      className={className}
      elevation={2}
      role="article"
      ariaLabel={`Preview of report: ${report.name}`}
    >
      <PreviewContainer>
        <PreviewHeader>
          <PreviewTitle>{report.name}</PreviewTitle>
          <IconButton
            onClick={() => handleExport(report.config.format)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || exportLoading}
            aria-label="Export report"
            title="Export report"
            size="large"
          >
            {(isLoading || exportLoading) ? (
              <CircularProgress size={24} />
            ) : (
              <DownloadIcon />
            )}
          </IconButton>
        </PreviewHeader>

        <PreviewContent
          role="region"
          aria-label="Report content"
        >
          {/* Render report content based on type */}
          {report.content && (
            <div dangerouslySetInnerHTML={{ __html: report.content }} />
          )}
        </PreviewContent>
      </PreviewContainer>
    </Card>
  );
};

// Default export for the ReportPreview component
export default ReportPreview;