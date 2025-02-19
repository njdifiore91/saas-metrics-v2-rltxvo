import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { CompanyMetricsForm } from '../../src/components/forms/CompanyMetricsForm';
import { useMetrics } from '../../src/hooks/useMetrics';
import { validateMetricValue } from '../../src/utils/validation.utils';
import { MetricType, MetricUnit, MetricTimeframe } from '../../src/types/metric.types';

// Mock useMetrics hook
jest.mock('../../src/hooks/useMetrics');
const mockUseMetrics = useMetrics as jest.Mock;

// Mock validation utils
jest.mock('../../src/utils/validation.utils');
const mockValidateMetricValue = validateMetricValue as jest.Mock;

// Test data
const mockMetricDefinitions = [
  {
    id: 'ndr',
    name: 'Net Dollar Retention',
    type: MetricType.RETENTION,
    unit: MetricUnit.PERCENTAGE,
    validationRules: [{ required: true, minValue: 0, maxValue: 200 }]
  },
  {
    id: 'cac_payback',
    name: 'CAC Payback Period',
    type: MetricType.EFFICIENCY,
    unit: MetricUnit.MONTHS,
    validationRules: [{ required: true, minValue: 0, maxValue: 60 }]
  },
  {
    id: 'magic_number',
    name: 'Magic Number',
    type: MetricType.SALES,
    unit: MetricUnit.RATIO,
    validationRules: [{ required: true, minValue: 0, maxValue: 10 }]
  }
];

const validMetricInputs = {
  ndr: '110',
  cac_payback: '12',
  magic_number: '1.5'
};

const invalidMetricInputs = {
  ndr: '250',
  cac_payback: '72',
  magic_number: '15'
};

describe('CompanyMetricsForm', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockUseMetrics.mockReturnValue({
      metricDefinitions: mockMetricDefinitions,
      submitMetrics: jest.fn(),
      calculateMetrics: jest.fn(),
      validateMetrics: jest.fn(),
      isLoading: false,
      error: null
    });

    mockValidateMetricValue.mockImplementation((value, rule) => ({
      isValid: true,
      errors: []
    }));
  });

  it('should render form with proper accessibility attributes', async () => {
    const { container } = render(
      <CompanyMetricsForm companyId="test-company" />
    );

    // Check ARIA labels
    expect(screen.getByRole('form')).toBeInTheDocument();
    mockMetricDefinitions.forEach(metric => {
      const input = screen.getByLabelText(`Enter ${metric.name}`);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    // Run accessibility audit
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should validate metric ranges correctly', async () => {
    const { getByLabelText } = render(
      <CompanyMetricsForm companyId="test-company" />
    );

    // Test NDR validation (0-200%)
    const ndrInput = getByLabelText('Enter Net Dollar Retention');
    await userEvent.type(ndrInput, '250');
    expect(ndrInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Value must be between 0% and 200%')).toBeInTheDocument();

    // Test CAC Payback validation (0-60 months)
    const cacPaybackInput = getByLabelText('Enter CAC Payback Period');
    await userEvent.type(cacPaybackInput, '72');
    expect(cacPaybackInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Value must be between 0 and 60 months')).toBeInTheDocument();

    // Test Magic Number validation (0-10)
    const magicNumberInput = getByLabelText('Enter Magic Number');
    await userEvent.type(magicNumberInput, '15');
    expect(magicNumberInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Value must be between 0 and 10')).toBeInTheDocument();
  });

  it('should handle async form submission correctly', async () => {
    const mockSubmitSuccess = jest.fn();
    const mockSubmitError = jest.fn();
    const mockValidationChange = jest.fn();

    const { getByRole, getByLabelText } = render(
      <CompanyMetricsForm
        companyId="test-company"
        onSubmitSuccess={mockSubmitSuccess}
        onSubmitError={mockSubmitError}
        onValidationChange={mockValidationChange}
      />
    );

    // Fill form with valid data
    for (const [metricId, value] of Object.entries(validMetricInputs)) {
      const input = getByLabelText(
        new RegExp(`Enter.*${mockMetricDefinitions.find(m => m.id === metricId)?.name}`)
      );
      await userEvent.type(input, value);
    }

    // Submit form
    const submitButton = getByRole('button', { name: /submit metrics/i });
    fireEvent.click(submitButton);

    // Verify loading state
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Submitting...');

    // Wait for submission to complete
    await waitFor(() => {
      expect(mockSubmitSuccess).toHaveBeenCalledWith(expect.any(Object));
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Submit Metrics');
    });
  });

  it('should handle form reset correctly', async () => {
    const { getByRole, getByLabelText } = render(
      <CompanyMetricsForm companyId="test-company" />
    );

    // Fill form with data
    for (const [metricId, value] of Object.entries(validMetricInputs)) {
      const input = getByLabelText(
        new RegExp(`Enter.*${mockMetricDefinitions.find(m => m.id === metricId)?.name}`)
      );
      await userEvent.type(input, value);
    }

    // Click reset button
    const resetButton = getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    // Verify form is reset
    mockMetricDefinitions.forEach(metric => {
      const input = getByLabelText(`Enter ${metric.name}`);
      expect(input).toHaveValue('');
    });
  });

  it('should handle keyboard navigation correctly', async () => {
    render(<CompanyMetricsForm companyId="test-company" />);

    // Test tab navigation
    await userEvent.tab();
    mockMetricDefinitions.forEach(metric => {
      expect(screen.getByLabelText(`Enter ${metric.name}`)).toHaveFocus();
      userEvent.tab();
    });

    // Test enter key submission
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    expect(mockUseMetrics().submitMetrics).toHaveBeenCalled();
  });

  it('should display error messages accessibly', async () => {
    mockValidateMetricValue.mockImplementation(() => ({
      isValid: false,
      errors: ['Invalid value']
    }));

    render(<CompanyMetricsForm companyId="test-company" />);

    const input = screen.getByLabelText('Enter Net Dollar Retention');
    await userEvent.type(input, '250');

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('Invalid value');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('-helper-text'));
  });
});