import React, { useMemo } from 'react';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { IMetricDefinition } from '../../interfaces/metric.interface';
import Card from '../common/Card';
import Tooltip from '../common/Tooltip';

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  width: '100%',
  cursor: props => props.onClick ? 'pointer' : 'default',
  transition: 'all 0.2s ease-in-out',
  '&:hover, &:focus-within': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4]
  }
}));

const MetricHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
  gap: theme.spacing(2)
}));

const MetricType = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  fontSize: '0.75rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

const FormulaContainer = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  margin: `${theme.spacing(2)} 0`,
  fontFamily: theme.typography.fontFamilyMetrics,
  position: 'relative',
  overflowX: 'auto',
  '&::before': {
    content: '"Formula"',
    position: 'absolute',
    top: -12,
    left: 8,
    backgroundColor: theme.palette.background.paper,
    padding: `0 ${theme.spacing(1)}`,
    fontSize: '0.75rem',
    color: theme.palette.text.secondary
  }
}));

const ValidationRules = styled('ul')(({ theme }) => ({
  margin: `${theme.spacing(2)} 0`,
  padding: `0 ${theme.spacing(2)}`,
  listStyle: 'none',
  '& li': {
    marginBottom: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '&::before': {
      content: '"•"',
      color: theme.palette.primary.main
    }
  }
}));

// Props interface
export interface MetricDefinitionProps {
  metric: IMetricDefinition;
  className?: string;
  onClick?: () => void;
}

// Helper function to format validation rules
const formatValidationRules = (rules: IMetricDefinition['validationRules']) => {
  return rules
    .sort((a, b) => a.priority - b.priority)
    .map(rule => {
      switch (rule.type) {
        case 'RANGE':
          return `Must be between ${rule.minValue} and ${rule.maxValue}`;
        case 'MIN':
          return `Minimum value: ${rule.minValue}`;
        case 'MAX':
          return `Maximum value: ${rule.maxValue}`;
        case 'CUSTOM':
          return rule.errorMessage;
        default:
          return '';
      }
    })
    .filter(Boolean);
};

// Main component
export const MetricDefinition: React.FC<MetricDefinitionProps> = React.memo(({
  metric,
  className,
  onClick
}) => {
  const formattedRules = useMemo(() => formatValidationRules(metric.validationRules), [metric.validationRules]);

  return (
    <StyledCard
      className={className}
      onClick={onClick}
      elevation={1}
      role="article"
      ariaLabel={`Metric definition for ${metric.name}`}
    >
      <MetricHeader>
        <div>
          <Typography variant="h6" component="h2">
            {metric.name}
          </Typography>
          <MetricType variant="body2">
            {metric.type} • {metric.timeframe}
          </MetricType>
        </div>
        <Tooltip
          content={`Unit: ${metric.unit}`}
          placement="top-end"
        >
          <Typography variant="metric">
            {metric.unit}
          </Typography>
        </Tooltip>
      </MetricHeader>

      <Typography variant="body1" color="textSecondary" paragraph>
        {metric.description}
      </Typography>

      <FormulaContainer role="math">
        <code>{metric.formula}</code>
      </FormulaContainer>

      {formattedRules.length > 0 && (
        <ValidationRules aria-label="Validation rules">
          {formattedRules.map((rule, index) => (
            <li key={index}>
              <Tooltip
                content={
                  <Typography variant="body2">
                    {metric.validationRules[index].errorMessage}
                  </Typography>
                }
                placement="right"
              >
                <Typography variant="body2">
                  {rule}
                </Typography>
              </Tooltip>
            </li>
          ))}
        </ValidationRules>
      )}
    </StyledCard>
  );
});

MetricDefinition.displayName = 'MetricDefinition';

export default MetricDefinition;