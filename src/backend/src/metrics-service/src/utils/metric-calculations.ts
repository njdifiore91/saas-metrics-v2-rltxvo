/**
 * Metric Calculation Utilities
 * Provides core calculation functions for startup metrics with validation
 * @version 1.0.0
 */

import { METRIC_VALIDATION_RANGES } from '../../../shared/types/metric-types';

/**
 * Error messages for metric calculations
 */
const ERROR_MESSAGES = {
  NEGATIVE_INPUT: 'Input parameters cannot be negative',
  ZERO_DENOMINATOR: 'Denominator cannot be zero',
  OUT_OF_RANGE: 'Calculated value is outside acceptable range',
  INVALID_MARGIN: 'Gross margin must be between 0-100%'
};

/**
 * Validates that all input parameters are non-negative numbers
 * @param params Array of numbers to validate
 * @throws Error if any parameter is negative
 */
const validateNonNegativeInputs = (...params: number[]): void => {
  if (params.some(param => param < 0)) {
    throw new Error(ERROR_MESSAGES.NEGATIVE_INPUT);
  }
};

/**
 * Calculates Net Dollar Retention (NDR) based on starting ARR and changes
 * @param startingARR Initial Annual Recurring Revenue
 * @param expansions Revenue from existing customer expansions
 * @param contractions Revenue lost from downgrades
 * @param churn Revenue lost from customer churn
 * @returns NDR as a percentage between 0-200%
 * @throws Error if inputs are invalid or result is out of range
 */
export const calculateNDR = (
  startingARR: number,
  expansions: number,
  contractions: number,
  churn: number
): number => {
  validateNonNegativeInputs(startingARR, expansions, contractions, churn);
  
  if (startingARR === 0) {
    throw new Error(ERROR_MESSAGES.ZERO_DENOMINATOR);
  }

  const endingARR = startingARR + expansions - contractions - churn;
  const ndr = (endingARR / startingARR) * 100;

  const { min, max } = METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION;
  if (ndr < min || ndr > max) {
    throw new Error(ERROR_MESSAGES.OUT_OF_RANGE);
  }

  return Number(ndr.toFixed(2));
};

/**
 * Calculates Customer Acquisition Cost (CAC) Payback Period in months
 * @param cac Customer Acquisition Cost
 * @param arr Annual Recurring Revenue
 * @param grossMargin Gross margin as a percentage
 * @returns CAC Payback Period in months (0-60)
 * @throws Error if inputs are invalid or result is out of range
 */
export const calculateCACPayback = (
  cac: number,
  arr: number,
  grossMargin: number
): number => {
  validateNonNegativeInputs(cac, arr, grossMargin);

  if (grossMargin < 0 || grossMargin > 100) {
    throw new Error(ERROR_MESSAGES.INVALID_MARGIN);
  }

  if (arr === 0) {
    throw new Error(ERROR_MESSAGES.ZERO_DENOMINATOR);
  }

  const monthlyRevenue = (arr * grossMargin) / (100 * 12);
  const paybackPeriod = (cac / monthlyRevenue);

  const { min, max } = METRIC_VALIDATION_RANGES.CAC_PAYBACK;
  if (paybackPeriod < min || paybackPeriod > max) {
    throw new Error(ERROR_MESSAGES.OUT_OF_RANGE);
  }

  return Number(paybackPeriod.toFixed(2));
};

/**
 * Calculates Magic Number based on net new ARR and sales & marketing spend
 * @param netNewARR Net new Annual Recurring Revenue
 * @param previousQuarterSMSpend Previous quarter's sales and marketing spend
 * @returns Magic Number ratio between 0-10
 * @throws Error if inputs are invalid or result is out of range
 */
export const calculateMagicNumber = (
  netNewARR: number,
  previousQuarterSMSpend: number
): number => {
  validateNonNegativeInputs(netNewARR, previousQuarterSMSpend);

  if (previousQuarterSMSpend === 0) {
    throw new Error(ERROR_MESSAGES.ZERO_DENOMINATOR);
  }

  const magicNumber = netNewARR / previousQuarterSMSpend;

  const { min, max } = METRIC_VALIDATION_RANGES.MAGIC_NUMBER;
  if (magicNumber < min || magicNumber > max) {
    throw new Error(ERROR_MESSAGES.OUT_OF_RANGE);
  }

  return Number(magicNumber.toFixed(2));
};

/**
 * Calculates Gross Margins as a percentage of revenue
 * @param revenue Total revenue
 * @param cogs Cost of Goods Sold
 * @returns Gross Margin percentage between -100% to 100%
 * @throws Error if inputs are invalid or result is out of range
 */
export const calculateGrossMargins = (
  revenue: number,
  cogs: number
): number => {
  validateNonNegativeInputs(revenue, cogs);

  if (revenue === 0) {
    throw new Error(ERROR_MESSAGES.ZERO_DENOMINATOR);
  }

  const grossMargin = ((revenue - cogs) / revenue) * 100;

  const { min, max } = METRIC_VALIDATION_RANGES.GROSS_MARGINS;
  if (grossMargin < min || grossMargin > max) {
    throw new Error(ERROR_MESSAGES.OUT_OF_RANGE);
  }

  return Number(grossMargin.toFixed(2));
};