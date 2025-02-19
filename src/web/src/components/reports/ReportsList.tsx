import React, { useState, useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';

// Internal imports
import Table, { TableProps, SortConfig } from '../common/Table';
import { IReport, ReportType, ReportFormat } from '../../interfaces/report.interface';
import { useReport } from '../../hooks/useReport';

// Styled components
const ProgressWrapper = styled(Box)`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const ProgressLabel = styled(Typography)`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
`;

interface ReportsListProps {
  onReportSelect?: (report: IReport) => void;
}

const ReportsList: React.FC<ReportsListProps> = ({ onReportSelect }) => {
  // State management
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'createdAt',
    direction: 'desc'
  });
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // Custom hook for report management
  const { reports, loading, error, fetchReports, downloadReport } = useReport();

  // Fetch reports on component mount
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle report download with progress tracking
  const handleDownload = useCallback(async (reportId: string, format: ReportFormat) => {
    try {
      setDownloadProgress(prev => ({ ...prev, [reportId]: 0 }));
      
      await downloadReport(reportId, {
        validateContent: true,
        maxRetries: 3,
        timeout: 30000
      });

      // Simulate progress updates
      const interval = setInterval(() => {
        setDownloadProgress(prev => {
          const currentProgress = prev[reportId] || 0;
          if (currentProgress >= 100) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [reportId]: currentProgress + 10 };
        });
      }, 500);

    } catch (err) {
      console.error('Download failed:', err);
      setDownloadProgress(prev => ({ ...prev, [reportId]: 0 }));
    }
  }, [downloadReport]);

  // Handle sorting
  const handleSort = useCallback((columnId: string) => {
    setSortConfig(prevConfig => ({
      column: columnId,
      direction: prevConfig.column === columnId && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Table columns configuration
  const columns = [
    {
      id: 'name',
      label: 'Report Name',
      sortable: true,
      width: '30%',
      format: (value: string) => (
        <Typography variant="body1" noWrap>
          {value}
        </Typography>
      )
    },
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      width: '20%',
      format: (value: ReportType) => (
        <Typography variant="body2">
          {value.replace('_', ' ')}
        </Typography>
      )
    },
    {
      id: 'createdAt',
      label: 'Created Date',
      sortable: true,
      width: '25%',
      format: (value: Date) => format(new Date(value), 'MMM dd, yyyy HH:mm')
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      width: '25%',
      format: (_, row: IReport) => (
        <Box display="flex" gap={1}>
          <Tooltip title="Download Report">
            <ProgressWrapper>
              <IconButton
                onClick={() => handleDownload(row.id, row.format)}
                disabled={downloadProgress[row.id] > 0 && downloadProgress[row.id] < 100}
                aria-label={`Download ${row.name}`}
              >
                {downloadProgress[row.id] > 0 && downloadProgress[row.id] < 100 ? (
                  <>
                    <CircularProgress
                      size={24}
                      value={downloadProgress[row.id]}
                      variant="determinate"
                    />
                    <ProgressLabel>{`${downloadProgress[row.id]}%`}</ProgressLabel>
                  </>
                ) : (
                  <DownloadIcon />
                )}
              </IconButton>
            </ProgressWrapper>
          </Tooltip>
          <Tooltip title="Delete Report">
            <IconButton
              onClick={() => {/* Implement delete functionality */}}
              aria-label={`Delete ${row.name}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  // Error handling
  if (error) {
    return (
      <Box p={3}>
        <Typography color="error" variant="body1">
          Error loading reports: {error.message}
        </Typography>
        <Button
          variant="contained"
          onClick={() => fetchReports()}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Table
      columns={columns}
      data={reports}
      isLoading={loading}
      page={page}
      rowsPerPage={rowsPerPage}
      onPageChange={setPage}
      onRowsPerPageChange={setRowsPerPage}
      emptyStateMessage="No reports available"
      ariaLabel="Reports list table"
    />
  );
};

export default ReportsList;