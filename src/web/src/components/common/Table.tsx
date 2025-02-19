// @mui/material v5.0.0
// react v18.2.0
import React, { useState, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { theme } from '../../assets/styles/theme';

// Interfaces
export interface Column {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (value: any) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps {
  columns: Column[];
  data: Array<any>;
  isLoading?: boolean;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  emptyStateMessage?: string;
  ariaLabel: string;
}

interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// Styled Components
const StyledTable = styled(MuiTable)`
  width: 100%;
  background-color: ${theme.palette.background.paper};
  border-radius: ${theme.shape.borderRadius}px;
  box-shadow: ${theme.shadows[1]};
  border: 1px solid ${theme.palette.divider};
`;

const TableHeaderCell = styled(TableCell)<{ sortable?: boolean }>`
  font-weight: 600;
  background-color: ${theme.palette.grey[50]};
  color: ${theme.palette.text.secondary};
  cursor: ${props => props.sortable ? 'pointer' : 'default'};
  user-select: none;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.sortable ? theme.palette.grey[100] : theme.palette.grey[50]};
  }
`;

const LoadingOverlay = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 1;
`;

const EmptyStateContainer = styled(Box)`
  padding: ${theme.spacing(4)};
  text-align: center;
  color: ${theme.palette.text.secondary};
`;

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  isLoading = false,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  emptyStateMessage = 'No data available',
  ariaLabel,
}) => {
  const [sortState, setSortState] = useState<SortState>({
    column: '',
    direction: 'asc'
  });

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sortState.column) return data;

    return [...data].sort((a, b) => {
      const column = columns.find(col => col.id === sortState.column);
      const aValue = column?.format ? column.format(a[sortState.column]) : a[sortState.column];
      const bValue = column?.format ? column.format(b[sortState.column]) : b[sortState.column];

      if (aValue === bValue) return 0;
      if (sortState.direction === 'asc') {
        return aValue < bValue ? -1 : 1;
      }
      return aValue > bValue ? -1 : 1;
    });
  }, [data, sortState, columns]);

  const handleSort = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.sortable) return;

    setSortState(prevState => ({
      column: columnId,
      direction: prevState.column === columnId && prevState.direction === 'asc' ? 'desc' : 'asc'
    }));

    // Announce sort change to screen readers
    const direction = sortState.column === columnId && sortState.direction === 'asc' ? 'descending' : 'ascending';
    const announcement = `Table sorted by ${column.label} in ${direction} order`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  };

  const renderSortIcon = (columnId: string) => {
    if (sortState.column !== columnId) return null;
    return sortState.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    onPageChange(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onRowsPerPageChange(parseInt(event.target.value, 10));
  };

  return (
    <Box position="relative">
      <TableContainer>
        <StyledTable aria-label={ariaLabel}>
          <TableHead>
            <TableRow>
              {columns.map(column => (
                <TableHeaderCell
                  key={column.id}
                  align={column.align}
                  sortable={column.sortable}
                  onClick={() => handleSort(column.id)}
                  style={{ width: column.width }}
                  aria-sort={
                    sortState.column === column.id
                      ? sortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  role={column.sortable ? 'columnheader button' : 'columnheader'}
                >
                  <Box display="flex" alignItems="center" justifyContent={column.align === 'right' ? 'flex-end' : 'flex-start'}>
                    {column.label}
                    {renderSortIcon(column.id)}
                  </Box>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyStateContainer>
                    <Typography variant="body1">{emptyStateMessage}</Typography>
                  </EmptyStateContainer>
                </TableCell>
              </TableRow>
            ) : (
              sortedData
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => (
                  <TableRow
                    key={index}
                    hover
                    role="row"
                    tabIndex={0}
                  >
                    {columns.map(column => (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        role="cell"
                      >
                        {column.format ? column.format(row[column.id]) : row[column.id]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
            )}
          </TableBody>
        </StyledTable>
      </TableContainer>

      <TablePagination
        component="div"
        count={data.length}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[5, 10, 25, 50]}
        aria-label="Table pagination"
      />

      {isLoading && (
        <LoadingOverlay>
          <CircularProgress
            aria-label="Loading data"
            size={40}
            thickness={4}
          />
        </LoadingOverlay>
      )}
    </Box>
  );
};

export default Table;