/**
 * Metric Model Implementation for the Startup Metrics Benchmarking Platform
 * Provides comprehensive metric management with validation, calculation, and audit capabilities
 * @version 1.0.0
 */

import { Model } from '@prisma/client'; // v4.0.0
import {
  IMetricDefinition,
  IMetricValidationRule,
  IMetricCalculationParams
} from '../../../shared/interfaces/metric.interface';
import {
  MetricType,
  MetricUnit,
  MetricTimeframe,
  METRIC_VALIDATION_RANGES
} from '../../../shared/types/metric-types';

/**
 * Interface for validation result with detailed error reporting
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata: Record<string, any>;
}

/**
 * Interface for calculation result with audit information
 */
interface CalculationResult {
  value: number;
  metadata: {
    calculatedAt: Date;
    calculatedBy: string;
    inputs: Record<string, number>;
    formula: string;
  };
}

/**
 * Comprehensive metric model with advanced validation and calculation capabilities
 */
@Model
export class MetricModel {
  public readonly id: string;
  public name: string;
  public type: MetricType;
  public unit: MetricUnit;
  public formula: string;
  public validationRules: IMetricValidationRule[];
  public calculationContext: Record<string, any>;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public lastCalculatedBy: string;
  public lastCalculatedAt: Date;

  /**
   * Creates a new metric instance with comprehensive initialization
   * @param definition Metric definition containing core properties and rules
   */
  constructor(definition: IMetricDefinition) {
    this.validateDefinition(definition);
    
    this.id = definition.id;
    this.name = definition.name;
    this.type = definition.type;
    this.unit = definition.unit;
    this.formula = definition.formula;
    this.validationRules = [...definition.validationRules];
    this.calculationContext = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.lastCalculatedAt = null;
    this.lastCalculatedBy = null;
  }

  /**
   * Validates metric value against defined rules with comprehensive error reporting
   * @param value Numeric value to validate
   * @param context Additional validation context
   * @returns Promise resolving to detailed validation result
   */
  public async validateValue(
    value: number,
    context: Record<string, any> = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const metadata: Record<string, any> = {};

    // Check if value is numeric
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push('Invalid metric value: must be a number');
      return { isValid: false, errors, metadata };
    }

    // Apply standard range validation based on metric type
    const standardRange = METRIC_VALIDATION_RANGES[this.name];
    if (standardRange && (value < standardRange.min || value > standardRange.max)) {
      errors.push(
        `Value must be between ${standardRange.min} and ${standardRange.max} ${standardRange.unit}`
      );
    }

    // Apply custom validation rules
    for (const rule of this.validationRules) {
      try {
        const isValid = await this.applyValidationRule(rule, value, context);
        if (!isValid) {
          errors.push(rule.errorMessage);
        }
      } catch (error) {
        errors.push(`Validation error: ${error.message}`);
      }
    }

    metadata.validatedAt = new Date();
    metadata.validationContext = context;

    return {
      isValid: errors.length === 0,
      errors,
      metadata
    };
  }

  /**
   * Calculates metric value using defined formula with comprehensive error handling
   * @param inputs Input values required for calculation
   * @param context Additional calculation context
   * @returns Promise resolving to calculation result with metadata
   */
  public async calculateValue(
    inputs: Record<string, number>,
    context: Record<string, any> = {}
  ): Promise<CalculationResult> {
    // Validate inputs
    this.validateCalculationInputs(inputs);

    try {
      // Parse and execute formula
      const value = await this.executeFormula(this.formula, inputs);

      // Validate calculated value
      const validationResult = await this.validateValue(value, context);
      if (!validationResult.isValid) {
        throw new Error(`Invalid calculation result: ${validationResult.errors.join(', ')}`);
      }

      // Update calculation audit trail
      this.lastCalculatedAt = new Date();
      this.lastCalculatedBy = context.calculatedBy || 'system';
      this.updatedAt = new Date();

      return {
        value,
        metadata: {
          calculatedAt: this.lastCalculatedAt,
          calculatedBy: this.lastCalculatedBy,
          inputs,
          formula: this.formula
        }
      };
    } catch (error) {
      throw new Error(`Calculation error: ${error.message}`);
    }
  }

  /**
   * Validates metric definition completeness
   * @param definition Metric definition to validate
   * @throws Error if definition is invalid
   */
  private validateDefinition(definition: IMetricDefinition): void {
    if (!definition.id || !definition.name || !definition.type || !definition.unit) {
      throw new Error('Invalid metric definition: missing required properties');
    }

    if (definition.validationRules?.length === 0) {
      throw new Error('Invalid metric definition: must include at least one validation rule');
    }
  }

  /**
   * Applies individual validation rule to metric value
   * @param rule Validation rule to apply
   * @param value Value to validate
   * @param context Validation context
   * @returns Promise resolving to validation result
   */
  private async applyValidationRule(
    rule: IMetricValidationRule,
    value: number,
    context: Record<string, any>
  ): Promise<boolean> {
    if (rule.type === 'RANGE') {
      return value >= rule.minValue && value <= rule.maxValue;
    }

    if (rule.type === 'CUSTOM' && rule.customValidation) {
      // Execute custom validation logic
      const validationFn = new Function('value', 'context', rule.customValidation);
      return validationFn(value, context);
    }

    return true;
  }

  /**
   * Validates calculation inputs completeness
   * @param inputs Input values for calculation
   * @throws Error if inputs are invalid
   */
  private validateCalculationInputs(inputs: Record<string, number>): void {
    const requiredInputs = this.extractRequiredInputs(this.formula);
    for (const input of requiredInputs) {
      if (!(input in inputs)) {
        throw new Error(`Missing required input: ${input}`);
      }
      if (typeof inputs[input] !== 'number' || isNaN(inputs[input])) {
        throw new Error(`Invalid input value for ${input}: must be a number`);
      }
    }
  }

  /**
   * Executes metric calculation formula
   * @param formula Formula to execute
   * @param inputs Input values for calculation
   * @returns Promise resolving to calculated value
   */
  private async executeFormula(
    formula: string,
    inputs: Record<string, number>
  ): Promise<number> {
    try {
      const calculationFn = new Function(...Object.keys(inputs), `return ${formula}`);
      return calculationFn(...Object.values(inputs));
    } catch (error) {
      throw new Error(`Formula execution error: ${error.message}`);
    }
  }

  /**
   * Extracts required input variables from formula
   * @param formula Formula to analyze
   * @returns Array of required input names
   */
  private extractRequiredInputs(formula: string): string[] {
    const variableRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    return [...new Set(formula.match(variableRegex) || [])];
  }
}