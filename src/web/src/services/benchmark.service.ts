/**
 * Service responsible for handling benchmark-related operations
 * Implements caching, comparison, and analysis of benchmark data
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import { IBenchmarkData, IBenchmarkComparison, IBenchmarkChartData } from '../interfaces/benchmark.interface';
import dayjs from 'dayjs'; // ^1.11.0

interface CacheEntry {
  data: IBenchmarkData;
  expires: number;
}

class BenchmarkService {
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL: number;
  private readonly MAX_RETRIES: number;
  private readonly CLEANUP_INTERVAL: number;

  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    this.MAX_RETRIES = 3;
    this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // Initialize cache cleanup interval
    setInterval(() => this.cleanupCache(), this.CLEANUP_INTERVAL);
  }

  /**
   * Retrieves benchmark data for a specific metric and revenue range with caching
   */
  public async getBenchmarkData(
    metricId: string,
    revenueRangeId: string
  ): Promise<IBenchmarkData> {
    const cacheKey = `${metricId}-${revenueRangeId}`;
    const cachedData = this.getFromCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await apiService.get<IBenchmarkData>(
        `${API_ENDPOINTS.BENCHMARKS.GET.replace(':id', metricId)}`,
        { revenueRangeId }
      );

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch benchmark data: ${error.message}`);
    }
  }

  /**
   * Compares a company's metric value against benchmark data
   */
  public async compareMetric(
    metricId: string,
    revenueRangeId: string,
    companyValue: number
  ): Promise<IBenchmarkComparison> {
    if (!metricId || !revenueRangeId || typeof companyValue !== 'number') {
      throw new Error('Invalid input parameters for metric comparison');
    }

    const benchmarkData = await this.getBenchmarkData(metricId, revenueRangeId);
    const percentile = this.calculatePercentile(benchmarkData, companyValue);

    return {
      metric: await this.getMetricDefinition(metricId),
      benchmarkData,
      companyValue,
      percentile,
      revenueRange: await this.getRevenueRange(revenueRangeId)
    };
  }

  /**
   * Prepares benchmark data for visualization
   */
  public async getBenchmarkChartData(
    metricId: string,
    revenueRangeId: string,
    companyValue: number
  ): Promise<IBenchmarkChartData> {
    const benchmarkData = await this.getBenchmarkData(metricId, revenueRangeId);
    const percentile = this.calculatePercentile(benchmarkData, companyValue);

    return {
      metricName: (await this.getMetricDefinition(metricId)).name,
      percentileValues: {
        p10: benchmarkData.p10Value,
        p25: benchmarkData.p25Value,
        p50: benchmarkData.p50Value,
        p75: benchmarkData.p75Value,
        p90: benchmarkData.p90Value
      },
      companyValue,
      companyPercentile: percentile
    };
  }

  /**
   * Calculates the exact percentile of a company's value within benchmark data
   */
  private calculatePercentile(
    benchmarkData: IBenchmarkData,
    companyValue: number
  ): number {
    const percentiles = [
      { value: benchmarkData.p10Value, percentile: 10 },
      { value: benchmarkData.p25Value, percentile: 25 },
      { value: benchmarkData.p50Value, percentile: 50 },
      { value: benchmarkData.p75Value, percentile: 75 },
      { value: benchmarkData.p90Value, percentile: 90 }
    ].sort((a, b) => a.value - b.value);

    // Handle edge cases
    if (companyValue <= percentiles[0].value) return 0;
    if (companyValue >= percentiles[percentiles.length - 1].value) return 100;

    // Find surrounding percentiles for interpolation
    for (let i = 0; i < percentiles.length - 1; i++) {
      if (companyValue >= percentiles[i].value && companyValue <= percentiles[i + 1].value) {
        return this.interpolatePercentile(
          percentiles[i].value,
          percentiles[i + 1].value,
          percentiles[i].percentile,
          percentiles[i + 1].percentile,
          companyValue
        );
      }
    }

    return 50; // Default to median if interpolation fails
  }

  /**
   * Performs linear interpolation between percentile brackets
   */
  private interpolatePercentile(
    lowerValue: number,
    upperValue: number,
    lowerPercentile: number,
    upperPercentile: number,
    value: number
  ): number {
    return lowerPercentile + 
      ((value - lowerValue) / (upperValue - lowerValue)) * 
      (upperPercentile - lowerPercentile);
  }

  /**
   * Retrieves cached benchmark data if valid
   */
  private getFromCache(key: string): IBenchmarkData | null {
    const cached = this.cache.get(key);
    if (!cached || cached.expires <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  /**
   * Caches benchmark data with expiration
   */
  private setCache(key: string, data: IBenchmarkData): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL
    });
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Helper method to get metric definition
   */
  private async getMetricDefinition(metricId: string): Promise<any> {
    const response = await apiService.get(
      `${API_ENDPOINTS.METRICS.GET.replace(':id', metricId)}`
    );
    return response.data;
  }

  /**
   * Helper method to get revenue range
   */
  private async getRevenueRange(revenueRangeId: string): Promise<any> {
    const response = await apiService.get(
      `/revenue-ranges/${revenueRangeId}`
    );
    return response.data;
  }
}

// Export singleton instance
export const benchmarkService = new BenchmarkService();