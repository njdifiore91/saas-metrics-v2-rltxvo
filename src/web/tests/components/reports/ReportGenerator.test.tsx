import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { renderWithProviders } from '@testing-library/react';

import ReportGenerator from '../../src/components/reports/ReportGenerator';
import { reportService } from '../../src/services/report.service';
import { 
  ReportType, 
  ReportFormat, 
  PageOrientation 
} from '../../src/interfaces/report.interface';
import { MetricType } from '../../src/types/metric.types';
import { ChartType } from '../../src/types/chart.types';
import { ERROR_CODES, ERROR_MESSAGES } from '../../src/constants/error.constants';

// Mock report service
vi.mock('../../src/services/report.service', () => ({
  reportService: {
    generateReport: vi.fn(),
    exportReport: vi.fn(),
    cancelGeneration: vi.fn(),
    cancelExport: vi.fn()
  }
}));

// Test data
const mockReportConfig = {
  type: ReportType.BENCHMARK_COMPARISON,
  format: ReportFormat.PDF,
  timeRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31')
  },
  selectedMetrics: ['arr', 'growth'],
  metricTypes: [MetricType.FINANCIAL, MetricType.EFFICIENCY],
  includeCharts: true,
  chartTypes: [ChartType.BAR, ChartType.LINE],
  orientation: PageOrientation.PORTRAIT,
  maxFileSize: 10 * 1024 * 1024,
  securityOptions: {
    enableEncryption: true,
    sanitizeContent: true,
    allowedDomains: []
  }
};

const mockReport = {
  id: 'test-report-123',
  name: 'Test Report',
  description: 'Test report description',
  type: ReportType.BENCHMARK_COMPARISON,
  format: ReportFormat.PDF,
  createdAt: new Date(),
  createdBy: 'test-user',
  config: mockReportConfig,
  version: '1.0.0'
};

describe('ReportGenerator', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    reportService.generateReport.mockReset();
    reportService.exportReport.mockReset();
  });

  describe('Rendering', () => {
    it('renders the component with initial state', () => {
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText('Report Configuration')).toBeInTheDocument();
      expect(screen.queryByLabelText('Report Preview')).not.toBeInTheDocument();
    });

    it('renders with provided initial configuration', () => {
      render(
        <ReportGenerator 
          onComplete={vi.fn()} 
          initialConfig={mockReportConfig}
        />
      );

      expect(screen.getByLabelText('Report Type')).toHaveValue(mockReportConfig.type);
      expect(screen.getByLabelText('Export Format')).toHaveValue(mockReportConfig.format);
    });

    it('passes accessibility audit', async () => {
      const { container } = render(<ReportGenerator onComplete={vi.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Configuration', () => {
    it('validates required fields before submission', async () => {
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      const submitButton = screen.getByRole('button', { name: /generate report/i });
      await user.click(submitButton);

      expect(screen.getByText(/select at least one metric type/i)).toBeInTheDocument();
    });

    it('handles metric type selection', async () => {
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      const metricTypeSelect = screen.getByLabelText('Metric Types');
      await user.click(metricTypeSelect);
      await user.click(screen.getByText('Financial'));
      
      expect(metricTypeSelect).toHaveValue([MetricType.FINANCIAL]);
    });

    it('toggles chart options when includeCharts is changed', async () => {
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      const chartsToggle = screen.getByRole('switch', { name: /include charts/i });
      await user.click(chartsToggle);
      
      expect(screen.getByLabelText('Chart Types')).toBeInTheDocument();
    });
  });

  describe('Generation', () => {
    it('shows progress during report generation', async () => {
      reportService.generateReport.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockReport), 1000);
        });
      });

      render(<ReportGenerator onComplete={vi.fn()} />);
      
      // Fill required fields
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles successful report generation', async () => {
      const onComplete = vi.fn();
      reportService.generateReport.mockResolvedValue(mockReport);

      render(<ReportGenerator onComplete={onComplete} />);
      
      // Fill required fields
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(mockReport);
        expect(screen.getByLabelText('Report Preview')).toBeInTheDocument();
      });
    });

    it('handles generation errors', async () => {
      reportService.generateReport.mockRejectedValue(new Error(ERROR_MESSAGES.API[ERROR_CODES.API.RESPONSE_ERROR]));

      render(<ReportGenerator onComplete={vi.fn()} />);
      
      // Fill required fields
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.API[ERROR_CODES.API.RESPONSE_ERROR]);
      });
    });
  });

  describe('Export', () => {
    it('handles report export with selected format', async () => {
      reportService.generateReport.mockResolvedValue(mockReport);
      
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      // Generate report first
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Report Preview')).toBeInTheDocument();
      });

      // Export report
      await user.click(screen.getByRole('button', { name: /export report/i }));
      
      expect(reportService.exportReport).toHaveBeenCalledWith(
        mockReport.id,
        mockReport.config.format
      );
    });

    it('handles export errors', async () => {
      reportService.generateReport.mockResolvedValue(mockReport);
      reportService.exportReport.mockRejectedValue(new Error('Export failed'));
      
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      // Generate report first
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Report Preview')).toBeInTheDocument();
      });

      // Attempt export
      await user.click(screen.getByRole('button', { name: /export report/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Export failed');
      });
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      render(<ReportGenerator onComplete={vi.fn()} />);
      
      const metricTypeSelect = screen.getByLabelText('Metric Types');
      metricTypeSelect.focus();
      fireEvent.keyDown(metricTypeSelect, { key: 'Enter' });
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('announces progress updates', async () => {
      reportService.generateReport.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockReport), 1000);
        });
      });

      render(
        <ReportGenerator 
          onComplete={vi.fn()} 
          accessibility={{ announceProgress: true, enableKeyboardNavigation: true, highContrast: false }}
        />
      );
      
      await user.click(screen.getByLabelText('Metric Types'));
      await user.click(screen.getByText('Financial'));
      await user.click(screen.getByRole('button', { name: /generate report/i }));
      
      await waitFor(() => {
        const progressAnnouncement = document.querySelector('[aria-live="polite"]');
        expect(progressAnnouncement).toBeInTheDocument();
      });
    });
  });
});