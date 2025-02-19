/**
 * Report Model for the Startup Metrics Benchmarking Platform
 * Implements Prisma-based data access with caching and audit support
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Logger } from 'winston';
import {
  IReportDefinition,
  IReportTemplate,
  ReportType,
  ExportFormat,
  PageOrientation,
  SectionType
} from '../../shared/interfaces/report.interface';

/**
 * Security classification levels for reports
 */
enum SecurityClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED'
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  REPORT_TTL: 3600, // 1 hour
  TEMPLATE_TTL: 86400, // 24 hours
  KEY_PREFIX: 'report:'
};

/**
 * Enhanced Prisma model class for report entities with template support,
 * security controls, and audit logging
 */
export class ReportModel {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;
  private readonly logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Creates a new report with template validation and security classification
   * @param reportData Report definition data
   * @returns Created report object
   */
  async createReport(reportData: IReportDefinition): Promise<IReportDefinition> {
    try {
      // Validate template compatibility
      await this.validateTemplate(reportData.templateId);

      // Create report with security classification
      const report = await this.prisma.report.create({
        data: {
          id: reportData.id,
          name: reportData.name,
          description: reportData.description,
          templateId: reportData.templateId,
          createdBy: reportData.createdBy,
          createdAt: new Date(),
          lastModifiedAt: new Date(),
          lastModifiedBy: reportData.createdBy,
          version: 1,
          securityClassification: SecurityClassification.CONFIDENTIAL
        }
      });

      // Cache the new report
      await this.cacheReport(report);

      // Log audit trail
      this.logger.info('Report created', {
        reportId: report.id,
        createdBy: report.createdBy,
        timestamp: report.createdAt
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to create report', { error, reportData });
      throw error;
    }
  }

  /**
   * Retrieves a report by ID with caching support
   * @param id Report ID
   * @returns Found report or null
   */
  async getReportById(id: string): Promise<IReportDefinition | null> {
    try {
      // Check cache first
      const cachedReport = await this.getCachedReport(id);
      if (cachedReport) {
        return cachedReport;
      }

      // Query database if not in cache
      const report = await this.prisma.report.findUnique({
        where: { id },
        include: {
          template: true
        }
      });

      if (report) {
        // Cache the retrieved report
        await this.cacheReport(report);

        // Log access
        this.logger.info('Report accessed', {
          reportId: id,
          timestamp: new Date()
        });
      }

      return report;
    } catch (error) {
      this.logger.error('Failed to retrieve report', { error, reportId: id });
      throw error;
    }
  }

  /**
   * Updates report with version control and audit support
   * @param id Report ID
   * @param updateData Partial report update data
   * @returns Updated report object
   */
  async updateReport(id: string, updateData: Partial<IReportDefinition>): Promise<IReportDefinition> {
    try {
      // Get current report
      const currentReport = await this.getReportById(id);
      if (!currentReport) {
        throw new Error('Report not found');
      }

      // Update report with version increment
      const updatedReport = await this.prisma.report.update({
        where: { id },
        data: {
          ...updateData,
          version: currentReport.version + 1,
          lastModifiedAt: new Date(),
          lastModifiedBy: updateData.lastModifiedBy
        }
      });

      // Invalidate cache
      await this.invalidateReportCache(id);

      // Log audit trail
      this.logger.info('Report updated', {
        reportId: id,
        modifiedBy: updateData.lastModifiedBy,
        timestamp: new Date(),
        version: updatedReport.version
      });

      return updatedReport;
    } catch (error) {
      this.logger.error('Failed to update report', { error, reportId: id, updateData });
      throw error;
    }
  }

  /**
   * Deletes report with security verification
   * @param id Report ID
   */
  async deleteReport(id: string): Promise<void> {
    try {
      // Archive report before deletion
      await this.archiveReport(id);

      // Delete from database
      await this.prisma.report.delete({
        where: { id }
      });

      // Clear cache
      await this.invalidateReportCache(id);

      // Log deletion
      this.logger.info('Report deleted', {
        reportId: id,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to delete report', { error, reportId: id });
      throw error;
    }
  }

  /**
   * Validates report template compatibility
   * @param templateId Template ID
   */
  private async validateTemplate(templateId: string): Promise<void> {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error('Invalid template ID');
    }
  }

  /**
   * Caches report data in Redis
   * @param report Report data to cache
   */
  private async cacheReport(report: IReportDefinition): Promise<void> {
    const cacheKey = `${CACHE_CONFIG.KEY_PREFIX}${report.id}`;
    await this.redis.setex(
      cacheKey,
      CACHE_CONFIG.REPORT_TTL,
      JSON.stringify(report)
    );
  }

  /**
   * Retrieves cached report data
   * @param id Report ID
   */
  private async getCachedReport(id: string): Promise<IReportDefinition | null> {
    const cacheKey = `${CACHE_CONFIG.KEY_PREFIX}${id}`;
    const cachedData = await this.redis.get(cacheKey);
    return cachedData ? JSON.parse(cachedData) : null;
  }

  /**
   * Invalidates report cache
   * @param id Report ID
   */
  private async invalidateReportCache(id: string): Promise<void> {
    const cacheKey = `${CACHE_CONFIG.KEY_PREFIX}${id}`;
    await this.redis.del(cacheKey);
  }

  /**
   * Archives report data before deletion
   * @param id Report ID
   */
  private async archiveReport(id: string): Promise<void> {
    const report = await this.getReportById(id);
    if (report) {
      await this.prisma.reportArchive.create({
        data: {
          reportId: id,
          reportData: JSON.stringify(report),
          archivedAt: new Date()
        }
      });
    }
  }
}