/**
 * Calculation Service Implementation
 * Handles metric calculations with caching, validation, and comprehensive error handling
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common';
import Redis from 'ioredis'; // v5.0.0
import { Logger } from 'winston'; // v3.8.0
import { IMetricCalculationParams } from '../../../shared/interfaces/metric.interface';
import { MetricModel } from '../models/metric.model';
import {
  calculateNDR,
  calculateCACPayback,
  calculateMagicNumber,
  calculateGrossMargins
} from '../utils/metric-calculations';

/**
 * Cache configuration for different metric types
 */
const CACHE_CONFIG = {
  TTL: {
    FINANCIAL: 900, // 15 minutes
    RETENTION: 1800, // 30 minutes
    EFFICIENCY: 3600, // 1 hour
    SALES: 300 // 5 minutes
  },
  KEY_PREFIX: 'metric:calc:'
};

/**
 * Error messages for calculation service
 */
const ERROR_MESSAGES = {
  CACHE_ERROR: 'Error accessing cache',
  CALCULATION_ERROR: 'Error performing calculation',
  VALIDATION_ERROR: 'Error validating result',
  INVALID_PARAMS: 'Invalid calculation parameters'
};

@Injectable()
export class CalculationService {
  private readonly circuitBreaker: {
    failures: number;
    lastFailure: Date;
    isOpen: boolean;
  };

  constructor(
    private readonly redisClient: Redis,
    private readonly logger: Logger,
    private readonly metricModel: MetricModel
  ) {
    this.initializeCircuitBreaker();
  }

  /**
   * Calculates metric value with caching and comprehensive error handling
   * @param params Metric calculation parameters
   * @returns Promise resolving to calculated metric value
   * @throws Error if calculation fails or result is invalid
   */
  public async calculateMetric(params: IMetricCalculationParams): Promise<number> {
    try {
      // Validate input parameters
      await this.validateParams(params);

      // Check circuit breaker
      if (this.circuitBreaker.isOpen) {
        throw new Error('Service temporarily unavailable');
      }

      // Try to get cached value
      const cachedValue = await this.getCachedCalculation(params);
      if (cachedValue !== null) {
        this.logger.info('Cache hit for metric calculation', { metricId: params.metricId });
        return cachedValue;
      }

      // Perform calculation
      const calculatedValue = await this.performCalculation(params);

      // Validate result
      const isValid = await this.validateCalculation(params.metricId, calculatedValue);
      if (!isValid) {
        throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
      }

      // Cache result
      await this.cacheCalculation(params, calculatedValue);

      return calculatedValue;
    } catch (error) {
      this.handleCalculationError(error);
      throw error;
    }
  }

  /**
   * Validates calculation result against defined rules
   * @param metricId Metric identifier
   * @param value Calculated value
   * @returns Promise resolving to validation result
   */
  private async validateCalculation(metricId: string, value: number): Promise<boolean> {
    try {
      const validationResult = await this.metricModel.validateValue(value);
      if (!validationResult.isValid) {
        this.logger.error('Validation failed for metric calculation', {
          metricId,
          errors: validationResult.errors
        });
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Error during calculation validation', { error });
      return false;
    }
  }

  /**
   * Retrieves cached calculation result
   * @param params Calculation parameters
   * @returns Promise resolving to cached value or null
   */
  private async getCachedCalculation(params: IMetricCalculationParams): Promise<number | null> {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cachedValue = await this.redisClient.get(cacheKey);
      return cachedValue ? parseFloat(cachedValue) : null;
    } catch (error) {
      this.logger.warn('Cache retrieval failed', { error });
      return null;
    }
  }

  /**
   * Caches calculation result with appropriate TTL
   * @param params Calculation parameters
   * @param value Calculated value
   */
  private async cacheCalculation(params: IMetricCalculationParams, value: number): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(params);
      const ttl = this.determineCacheTTL(params.metricId);
      await this.redisClient.setex(cacheKey, ttl, value.toString());
    } catch (error) {
      this.logger.error('Failed to cache calculation result', { error });
    }
  }

  /**
   * Performs actual metric calculation based on metric type
   * @param params Calculation parameters
   * @returns Promise resolving to calculated value
   */
  private async performCalculation(params: IMetricCalculationParams): Promise<number> {
    const metric = await this.metricModel.findById(params.metricId);
    
    switch (metric.name) {
      case 'NET_DOLLAR_RETENTION':
        return calculateNDR(
          params.startingARR,
          params.expansions,
          params.contractions,
          params.churn
        );
      case 'CAC_PAYBACK':
        return calculateCACPayback(
          params.cac,
          params.arr,
          params.grossMargin
        );
      case 'MAGIC_NUMBER':
        return calculateMagicNumber(
          params.netNewARR,
          params.previousQuarterSMSpend
        );
      case 'GROSS_MARGINS':
        return calculateGrossMargins(
          params.revenue,
          params.cogs
        );
      default:
        throw new Error(`Unsupported metric type: ${metric.name}`);
    }
  }

  /**
   * Generates cache key from calculation parameters
   * @param params Calculation parameters
   * @returns Cache key string
   */
  private generateCacheKey(params: IMetricCalculationParams): string {
    return `${CACHE_CONFIG.KEY_PREFIX}${params.metricId}:${params.companyId}:${params.timeframe}`;
  }

  /**
   * Determines appropriate cache TTL based on metric type
   * @param metricId Metric identifier
   * @returns TTL in seconds
   */
  private determineCacheTTL(metricId: string): number {
    const metric = this.metricModel.findById(metricId);
    return CACHE_CONFIG.TTL[metric.type] || CACHE_CONFIG.TTL.FINANCIAL;
  }

  /**
   * Initializes circuit breaker for external service protection
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      isOpen: false
    };
  }

  /**
   * Handles calculation errors with circuit breaker logic
   * @param error Error that occurred during calculation
   */
  private handleCalculationError(error: Error): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = new Date();
    
    if (this.circuitBreaker.failures >= 5) {
      this.circuitBreaker.isOpen = true;
      setTimeout(() => {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      }, 30000); // Reset after 30 seconds
    }

    this.logger.error('Calculation error occurred', {
      error,
      circuitBreaker: this.circuitBreaker
    });
  }

  /**
   * Validates calculation parameters
   * @param params Parameters to validate
   * @throws Error if parameters are invalid
   */
  private async validateParams(params: IMetricCalculationParams): Promise<void> {
    if (!params.metricId || !params.companyId || !params.timeframe) {
      throw new Error(ERROR_MESSAGES.INVALID_PARAMS);
    }
  }
}