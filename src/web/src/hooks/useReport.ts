// External imports - version specified in package.json
import { useDispatch, useSelector } from 'react-redux';
import { useState, useCallback, useEffect } from 'react';

// Internal imports
import { 
  IReport, 
  IReportConfig, 
  ReportType, 
  ReportFormat, 
  PageOrientation 
} from '../interfaces/report.interface';

// Types for the hook's return interface
interface ReportError {
  code: string;
  message: string;
  details?: unknown;
}

interface ReportCache {
  reports: Record<string, IReport>;
  lastUpdated: Date;
  strategy: 'memory' | 'localStorage';
}

interface ProgressCallback {
  onProgress: (progress: number) => void;
}

interface DownloadOptions {
  validateContent?: boolean;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Custom hook for managing report generation, configuration, and export functionality
 * with enhanced progress tracking, caching, and error handling capabilities.
 */
export const useReport = () => {
  const dispatch = useDispatch();
  
  // Redux state selectors
  const reports = useSelector((state: any) => state.reports.items);
  const isLoading = useSelector((state: any) => state.reports.loading);
  
  // Local state
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<ReportError | null>(null);
  const [cache, setCache] = useState<ReportCache>({
    reports: {},
    lastUpdated: new Date(),
    strategy: 'memory'
  });

  // Progress polling interval reference
  let progressInterval: NodeJS.Timeout;

  /**
   * Validates report configuration before generation
   */
  const validateConfig = (config: IReportConfig): boolean => {
    if (!config.selectedMetrics || config.selectedMetrics.length === 0) {
      setError({ code: 'INVALID_CONFIG', message: 'No metrics selected' });
      return false;
    }
    
    if (!config.timeRange || !config.timeRange.startDate || !config.timeRange.endDate) {
      setError({ code: 'INVALID_CONFIG', message: 'Invalid time range' });
      return false;
    }

    return true;
  };

  /**
   * Checks cache for existing report
   */
  const checkCache = useCallback((config: IReportConfig): IReport | null => {
    const cacheKey = JSON.stringify({
      metrics: config.selectedMetrics,
      timeRange: config.timeRange,
      type: config.type
    });

    const cachedReport = cache.reports[cacheKey];
    if (cachedReport && 
        new Date().getTime() - new Date(cachedReport.createdAt).getTime() < 3600000) {
      return cachedReport;
    }

    return null;
  }, [cache]);

  /**
   * Handles report generation with progress tracking and caching
   */
  const generateReport = useCallback(async (
    config: IReportConfig, 
    { onProgress }: ProgressCallback
  ): Promise<void> => {
    try {
      setError(null);
      setProgress(0);

      // Validate configuration
      if (!validateConfig(config)) {
        return;
      }

      // Check cache
      const cachedReport = checkCache(config);
      if (cachedReport) {
        setProgress(100);
        onProgress?.(100);
        return;
      }

      // Start progress polling
      progressInterval = setInterval(() => {
        setProgress(current => {
          const newProgress = Math.min(current + 10, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 1000);

      // Dispatch report generation action
      await dispatch({
        type: 'GENERATE_REPORT',
        payload: config
      });

      // Update cache
      setCache(prevCache => ({
        ...prevCache,
        reports: {
          ...prevCache.reports,
          [JSON.stringify(config)]: {
            id: Date.now().toString(),
            createdAt: new Date(),
            ...config
          }
        },
        lastUpdated: new Date()
      }));

      setProgress(100);
      onProgress?.(100);

    } catch (err) {
      setError({
        code: 'GENERATION_ERROR',
        message: 'Failed to generate report',
        details: err
      });
    } finally {
      clearInterval(progressInterval);
    }
  }, [dispatch, checkCache]);

  /**
   * Handles report download with security validation
   */
  const downloadReport = useCallback(async (
    reportId: string,
    options: DownloadOptions = {}
  ): Promise<void> => {
    try {
      setError(null);

      const report = reports.find((r: IReport) => r.id === reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Security validation
      if (options.validateContent) {
        const validationResult = await dispatch({
          type: 'VALIDATE_REPORT_CONTENT',
          payload: reportId
        });

        if (!validationResult.valid) {
          throw new Error('Report content validation failed');
        }
      }

      // Generate secure download URL
      const downloadUrl = await dispatch({
        type: 'GET_REPORT_DOWNLOAD_URL',
        payload: {
          reportId,
          format: report.format
        }
      });

      // Trigger download with security headers
      const response = await fetch(downloadUrl, {
        headers: {
          'Content-Security-Policy': "default-src 'self'",
          'X-Content-Type-Options': 'nosniff'
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.${report.format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError({
        code: 'DOWNLOAD_ERROR',
        message: 'Failed to download report',
        details: err
      });
    }
  }, [dispatch, reports]);

  /**
   * Fetches available reports
   */
  const fetchReports = useCallback(async (): Promise<void> => {
    try {
      await dispatch({ type: 'FETCH_REPORTS' });
    } catch (err) {
      setError({
        code: 'FETCH_ERROR',
        message: 'Failed to fetch reports',
        details: err
      });
    }
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(progressInterval);
    };
  }, []);

  return {
    // State
    reports,
    progress,
    loading: isLoading,
    error,
    cache,

    // Actions
    generateReport,
    downloadReport,
    fetchReports
  };
};