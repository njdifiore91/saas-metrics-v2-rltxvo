import { format, addMonths, addQuarters, addYears } from 'date-fns'; // v2.30.0
import { MetricTimeframe } from '../types/metric.types';

// Cache for memoized period calculations
const periodCache = new Map<string, Date[]>();

/**
 * Error class for date-related operations
 */
class DateUtilError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateUtilError';
  }
}

/**
 * Type guard for Date objects
 */
const isValidDate = (date: any): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Formats a date into a standardized string format with locale support
 * @param date - Date to format
 * @param formatString - Format pattern to apply
 * @param locale - Locale string (default: 'en-US')
 * @returns Formatted date string
 * @throws DateUtilError if date is invalid
 */
export const formatDate = (
  date: Date,
  formatString: string,
  locale: string = 'en-US'
): string => {
  if (!isValidDate(date)) {
    throw new DateUtilError('Invalid date provided');
  }

  try {
    return format(date, formatString, { locale });
  } catch (error) {
    throw new DateUtilError(`Error formatting date: ${error.message}`);
  }
};

/**
 * Calculates start and end dates based on timeframe and number of periods
 * @param timeframe - MetricTimeframe enum value
 * @param periods - Number of periods to calculate
 * @param endDate - Optional end date (defaults to current date)
 * @returns Object containing start and end dates with validation status
 */
export const getDateRange = (
  timeframe: MetricTimeframe,
  periods: number,
  endDate?: Date
): { startDate: Date; endDate: Date; isValid: boolean; error?: string } => {
  const result = {
    startDate: new Date(),
    endDate: endDate || new Date(),
    isValid: true,
    error: undefined
  };

  // Validate inputs
  if (periods <= 0 || periods > 60) {
    return {
      ...result,
      isValid: false,
      error: 'Periods must be between 1 and 60'
    };
  }

  if (endDate && !isValidDate(endDate)) {
    return {
      ...result,
      isValid: false,
      error: 'Invalid end date provided'
    };
  }

  try {
    const end = endDate || new Date();
    let start: Date;

    switch (timeframe) {
      case MetricTimeframe.MONTHLY:
        start = addMonths(end, -periods + 1);
        break;
      case MetricTimeframe.QUARTERLY:
        start = addQuarters(end, -periods + 1);
        break;
      case MetricTimeframe.ANNUAL:
        start = addYears(end, -periods + 1);
        break;
      default:
        throw new DateUtilError('Invalid timeframe provided');
    }

    // Validate start date is not before minimum system date (2000-01-01)
    const minDate = new Date(2000, 0, 1);
    if (start < minDate) {
      return {
        ...result,
        isValid: false,
        error: 'Start date cannot be before year 2000'
      };
    }

    return {
      startDate: start,
      endDate: end,
      isValid: true
    };
  } catch (error) {
    return {
      ...result,
      isValid: false,
      error: `Error calculating date range: ${error.message}`
    };
  }
};

/**
 * Adds a specified number of periods to a date based on timeframe
 * @param date - Base date
 * @param timeframe - MetricTimeframe enum value
 * @param periods - Number of periods to add
 * @returns New date after adding periods
 * @throws DateUtilError for invalid inputs
 */
export const addPeriod = (
  date: Date,
  timeframe: MetricTimeframe,
  periods: number
): Date => {
  if (!isValidDate(date)) {
    throw new DateUtilError('Invalid date provided');
  }

  if (periods < 0) {
    throw new DateUtilError('Periods must be non-negative');
  }

  try {
    switch (timeframe) {
      case MetricTimeframe.MONTHLY:
        return addMonths(date, periods);
      case MetricTimeframe.QUARTERLY:
        return addQuarters(date, periods);
      case MetricTimeframe.ANNUAL:
        return addYears(date, periods);
      default:
        throw new DateUtilError('Invalid timeframe provided');
    }
  } catch (error) {
    throw new DateUtilError(`Error adding periods: ${error.message}`);
  }
};

/**
 * Generates an array of dates for a given timeframe range with memoization
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param timeframe - MetricTimeframe enum value
 * @returns Array of dates representing each period
 * @throws DateUtilError for invalid inputs
 */
export const getTimeframePeriods = (
  startDate: Date,
  endDate: Date,
  timeframe: MetricTimeframe
): Date[] => {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new DateUtilError('Invalid date(s) provided');
  }

  if (endDate < startDate) {
    throw new DateUtilError('End date must be after start date');
  }

  // Generate cache key
  const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${timeframe}`;

  // Check cache first
  const cachedResult = periodCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const periods: Date[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      periods.push(new Date(currentDate));
      currentDate = addPeriod(currentDate, timeframe, 1);
    }

    // Cache the result
    periodCache.set(cacheKey, periods);

    // Implement cache size limit
    if (periodCache.size > 100) {
      const firstKey = periodCache.keys().next().value;
      periodCache.delete(firstKey);
    }

    return periods;
  } catch (error) {
    throw new DateUtilError(`Error generating timeframe periods: ${error.message}`);
  }
};