// @mui/material v5.0.0
// react v18.2.0
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { CircularProgress, Typography, Tooltip, Box } from '@mui/material';
import Table from '../common/Table';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricType, MetricUnit } from '../../types/metric.types';
import dayjs from 'dayjs'; // ^1.11.0

// Styled components
const ListContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  minHeight: 400,
  position: 'relative'
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
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  zIndex: 1
}));

// Props interface
interface MetricsListProps {
  companyId: string;
  filterTypes?: MetricType[];
  onMetricSelect?: (metricId: string) => void;
  showLoading?: boolean;
  rowsPerPage?: number;
}

// Helper function to format metric values based on unit type
const formatMetricValue = (value: number, unit: MetricUnit): string => {
  if (value === null || value === undefined) return '-';

  switch (unit) {
    case MetricUnit.PERCENTAGE:
      return `${value.toFixed(1)}%`;
    case MetricUnit.CURRENCY:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    case MetricUnit.RATIO:
      return value.toFixed(2);
    case MetricUnit.MONTHS:
      return `${value.toFixed(1)} months`;
    default:
      return value.toString();
  }
};

export const MetricsList: React.FC<MetricsListProps> = ({
  companyId,
  filterTypes = [],
  onMetricSelect,
  showLoading = true,
  rowsPerPage = 10
}) => {
  // State management
  const [page, setPage] = useState(0);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  // Custom hook for metrics data
  const { 
    metricDefinitions, 
    companyMetrics, 
    isLoading,
    error 
  } = useMetrics(companyId);

  // Filter metrics based on provided types
  const filteredMetrics = useMemo(() => {
    return metricDefinitions.filter(metric => 
      filterTypes.length === 0 || filterTypes.includes(metric.type)
    );
  }, [metricDefinitions, filterTypes]);

  // Generate table columns configuration
  const columns = useMemo(() => [
    {
      id: 'name',
      label: 'Metric Name',
      sortable: true,
      width: '30%',
      format: (value: string) => (
        <Typography variant="body1" fontWeight={500}>
          {value}
        </Typography>
      )
    },
    {
      id: 'type',
      label: 'Category',
      sortable: true,
      width: '20%',
      format: (value: MetricType) => (
        <Tooltip title={`${value} metrics category`}>
          <Typography variant="body2" color="textSecondary">
            {value}
          </Typography>
        </Tooltip>
      )
    },
    {
      id: 'value',
      label: 'Current Value',
      sortable: true,
      width: '25%',
      align: 'right' as const,
      format: (value: number, row: any) => (
        <Typography variant="metric">
          {formatMetricValue(value, row.unit)}
        </Typography>
      )
    },
    {
      id: 'lastUpdated',
      label: 'Last Updated',
      sortable: true,
      width: '25%',
      format: (value: string) => (
        <Tooltip title={dayjs(value).format('YYYY-MM-DD HH:mm:ss')}>
          <Typography variant="body2" color="textSecondary">
            {dayjs(value).fromNow()}
          </Typography>
        </Tooltip>
      )
    }
  ], []);

  // Transform metrics data for table display
  const tableData = useMemo(() => {
    return filteredMetrics.map(metric => ({
      id: metric.id,
      name: metric.name,
      type: metric.type,
      unit: metric.unit,
      value: companyMetrics[metric.id] || 0,
      lastUpdated: dayjs().subtract(1, 'hour').toISOString() // Example timestamp
    }));
  }, [filteredMetrics, companyMetrics]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Handle rows per page change
  const handleRowsPerPageChange = useCallback((newRowsPerPage: number) => {
    setPage(0);
  }, []);

  // Handle row selection
  const handleRowClick = useCallback((event: React.MouseEvent, rowData: any) => {
    setSelectedMetricId(rowData.id);
    if (onMetricSelect) {
      onMetricSelect(rowData.id);
    }
  }, [onMetricSelect]);

  // Effect to handle errors
  useEffect(() => {
    if (error) {
      console.error('Metrics loading error:', error);
      // Implement error handling UI if needed
    }
  }, [error]);

  return (
    <ListContainer>
      <Table
        columns={columns}
        data={tableData}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        isLoading={showLoading && isLoading}
        emptyStateMessage="No metrics available"
        ariaLabel="Metrics list table"
      />

      {showLoading && isLoading && (
        <LoadingOverlay>
          <CircularProgress 
            size={40} 
            thickness={4}
            aria-label="Loading metrics"
          />
        </LoadingOverlay>
      )}
    </ListContainer>
  );
};

export default MetricsList;