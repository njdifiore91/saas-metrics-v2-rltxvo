/**
 * Enhanced Metrics Controller
 * Implements REST API endpoints for metric management with batch processing,
 * caching, compression and RFC 7807 compliant error handling
 * @version 1.0.0
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseInterceptors,
  UseGuards,
  HttpStatus,
  CacheInterceptor,
  Logger,
  BadRequestException
} from '@nestjs/common'; // ^9.0.0
import { CompressionInterceptor } from '@nestjs/common'; // ^9.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0

import { MetricsService } from '../services/metrics.service';
import { validateMetricInput } from '../validators/metric.validator';
import { 
  IMetricDefinition, 
  IMetricValue, 
  IMetricCalculationParams 
} from '../../../shared/interfaces/metric.interface';
import { MetricTimeframe } from '../../../shared/types/metric-types';

// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

// Pagination interface
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Controller('metrics')
@UseInterceptors(CompressionInterceptor)
@UseGuards(AuthGuard)
export class MetricsController {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger = new Logger(MetricsController.name);

  constructor(
    private readonly metricsService: MetricsService
  ) {
    this.circuitBreaker = new CircuitBreaker(
      this.metricsService.calculateMetricBatch.bind(this.metricsService),
      CIRCUIT_BREAKER_OPTIONS
    );
  }

  /**
   * Create multiple metric definitions in batch
   * @param metricDefinitions Array of metric definitions to create
   */
  @Post('batch')
  @RateLimit({ ttl: 60, limit: 100 })
  async createMetricBatch(
    @Body() metricDefinitions: IMetricDefinition[]
  ): Promise<IMetricDefinition[]> {
    try {
      if (!Array.isArray(metricDefinitions) || metricDefinitions.length === 0) {
        throw new BadRequestException('Invalid batch input');
      }

      if (metricDefinitions.length > 100) {
        throw new BadRequestException('Batch size exceeds limit of 100');
      }

      return await this.metricsService.createMetricBatch(metricDefinitions);
    } catch (error) {
      this.logger.error('Failed to create metric batch', error);
      throw error;
    }
  }

  /**
   * Calculate multiple metrics in batch with caching
   */
  @Post('calculate/batch')
  @UseInterceptors(CacheInterceptor)
  async calculateMetricBatch(
    @Body() params: {
      companyId: string;
      metricIds: string[];
      timeframe: MetricTimeframe;
      startDate: Date;
      endDate: Date;
    }
  ): Promise<{
    results: Array<{
      metricId: string;
      value: number;
      status: 'SUCCESS' | 'ERROR';
      error?: string;
    }>;
    auditTrail: {
      processedAt: Date;
      duration: number;
      cacheHits: number;
    };
  }> {
    try {
      return await this.circuitBreaker.fire({
        ...params,
        timeframe: MetricTimeframe[params.timeframe]
      });
    } catch (error) {
      this.logger.error('Failed to calculate metric batch', error);
      throw error;
    }
  }

  /**
   * Record metric values in batch with validation
   */
  @Post('values/batch')
  async recordMetricValueBatch(
    @Body() metricValues: IMetricValue[]
  ): Promise<{
    results: Array<{
      id: string;
      status: 'SUCCESS' | 'ERROR';
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    try {
      // Validate each metric value
      const validationResults = await Promise.all(
        metricValues.map(async (value) => {
          const definition = await this.metricsService.getMetricDefinition(value.metricId);
          return validateMetricInput(value, definition);
        })
      );

      // Filter valid values and record them
      const validValues = metricValues.filter((_, index) => validationResults[index].isValid);
      const results = await this.metricsService.recordMetricValueBatch(validValues);

      // Prepare response summary
      const failed = validationResults.filter(r => !r.isValid).length;
      return {
        results,
        summary: {
          total: metricValues.length,
          successful: validValues.length,
          failed
        }
      };
    } catch (error) {
      this.logger.error('Failed to record metric values batch', error);
      throw error;
    }
  }

  /**
   * Get paginated metric history with caching
   */
  @Get(':metricId/history')
  @UseInterceptors(CacheInterceptor)
  async getMetricHistoryPaginated(
    @Param('metricId') metricId: string,
    @Query('companyId') companyId: string,
    @Query() pagination: PaginationParams
  ): Promise<{
    data: IMetricValue[];
    meta: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20, sortBy = 'recordedAt', order = 'desc' } = pagination;
      
      return await this.metricsService.getMetricHistoryPaginated(
        companyId,
        metricId,
        { page, limit, sortBy, order }
      );
    } catch (error) {
      this.logger.error('Failed to get metric history', error);
      throw error;
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck(): Promise<{
    status: string;
    version: string;
    timestamp: Date;
    details: {
      database: boolean;
      cache: boolean;
      calculator: boolean;
    };
  }> {
    try {
      const health = await this.metricsService.checkHealth();
      return {
        status: health.isHealthy ? 'healthy' : 'unhealthy',
        version: '1.0.0',
        timestamp: new Date(),
        details: health.details
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }
}