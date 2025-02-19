import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { 
  IMetricDefinition, 
  IMetricValidationRule,
  IMetricCalculationParams
} from '../interfaces/metric.interface';
import { 
  MetricType, 
  MetricTimeframe,
  MetricValidationType 
} from '../types/metric.types';
import { metricService } from '../services/metric.service';
import { ERROR_CODES } from '../constants/api.constants';

// State interface
interface MetricState {
  definitions: Record<string, IMetricDefinition>;
  validationResults: Record<string, ValidationResult>;
  calculationCache: Record<string, CalculationCacheEntry>;
  loading: {
    definitions: boolean;
    validation: boolean;
    calculation: boolean;
  };
  error: string | null;
  lastUpdated: string | null;
  batchOperations: {
    pending: string[];
    completed: string[];
    failed: string[];
  };
}

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  timestamp: string;
}

// Calculation cache entry interface
interface CalculationCacheEntry {
  value: number;
  params: IMetricCalculationParams;
  timestamp: string;
  expiresAt: string;
}

// Initial state
const initialState: MetricState = {
  definitions: {},
  validationResults: {},
  calculationCache: {},
  loading: {
    definitions: false,
    validation: false,
    calculation: false
  },
  error: null,
  lastUpdated: null,
  batchOperations: {
    pending: [],
    completed: [],
    failed: []
  }
};

// Async thunks
export const fetchMetricDefinitions = createAsyncThunk(
  'metrics/fetchDefinitions',
  async (forceRefresh: boolean = false) => {
    const definitions = await metricService.getMetricDefinitions(forceRefresh);
    return definitions;
  }
);

export const validateMetricBatch = createAsyncThunk(
  'metrics/validateBatch',
  async (metrics: Array<{ metricId: string; value: number; timeframe: MetricTimeframe }>) => {
    const results = await metricService.validateMetricBatch(metrics);
    return results;
  }
);

export const calculateMetricBatch = createAsyncThunk(
  'metrics/calculateBatch',
  async (requests: Array<{ metricId: string; value: number; params: IMetricCalculationParams }>) => {
    const results = await metricService.calculateMetricBatch(requests);
    return results;
  }
);

export const clearCalculationCache = createAsyncThunk(
  'metrics/clearCache',
  async (metricIds: string[]) => {
    return metricIds;
  }
);

// Create slice
const metricSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    invalidateCache: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(metricId => {
        delete state.calculationCache[metricId];
      });
      state.lastUpdated = new Date().toISOString();
    },
    clearValidationResults: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(metricId => {
        delete state.validationResults[metricId];
      });
    },
    resetBatchOperations: (state) => {
      state.batchOperations = {
        pending: [],
        completed: [],
        failed: []
      };
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch definitions handlers
      .addCase(fetchMetricDefinitions.pending, (state) => {
        state.loading.definitions = true;
        state.error = null;
      })
      .addCase(fetchMetricDefinitions.fulfilled, (state, action) => {
        state.loading.definitions = false;
        state.definitions = action.payload.reduce((acc, definition) => {
          acc[definition.id] = definition;
          return acc;
        }, {} as Record<string, IMetricDefinition>);
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchMetricDefinitions.rejected, (state, action) => {
        state.loading.definitions = false;
        state.error = action.error.message || ERROR_CODES.DATA.VALIDATION_ERROR;
      })
      // Validate batch handlers
      .addCase(validateMetricBatch.pending, (state) => {
        state.loading.validation = true;
        state.error = null;
      })
      .addCase(validateMetricBatch.fulfilled, (state, action) => {
        state.loading.validation = false;
        action.payload.forEach(result => {
          state.validationResults[result.metricId] = {
            isValid: result.isValid,
            errors: result.errors,
            timestamp: new Date().toISOString()
          };
        });
      })
      .addCase(validateMetricBatch.rejected, (state, action) => {
        state.loading.validation = false;
        state.error = action.error.message || ERROR_CODES.DATA.VALIDATION_ERROR;
      })
      // Calculate batch handlers
      .addCase(calculateMetricBatch.pending, (state, action) => {
        state.loading.calculation = true;
        state.batchOperations.pending = action.meta.arg.map(req => req.metricId);
      })
      .addCase(calculateMetricBatch.fulfilled, (state, action) => {
        state.loading.calculation = false;
        action.payload.forEach(result => {
          state.calculationCache[result.metricId] = {
            value: result.value,
            params: action.meta.arg.find(req => req.metricId === result.metricId)?.params!,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes cache
          };
          state.batchOperations.completed.push(result.metricId);
          state.batchOperations.pending = state.batchOperations.pending
            .filter(id => id !== result.metricId);
        });
      })
      .addCase(calculateMetricBatch.rejected, (state, action) => {
        state.loading.calculation = false;
        state.error = action.error.message || ERROR_CODES.DATA.VALIDATION_ERROR;
        state.batchOperations.failed = state.batchOperations.pending;
        state.batchOperations.pending = [];
      })
      // Clear cache handlers
      .addCase(clearCalculationCache.fulfilled, (state, action) => {
        action.payload.forEach(metricId => {
          delete state.calculationCache[metricId];
        });
        state.lastUpdated = new Date().toISOString();
      });
  }
});

// Selectors
export const selectMetricDefinitions = (state: { metrics: MetricState }) => 
  Object.values(state.metrics.definitions);

export const selectMetricById = (state: { metrics: MetricState }, metricId: string) =>
  state.metrics.definitions[metricId];

export const selectValidationResult = (state: { metrics: MetricState }, metricId: string) =>
  state.metrics.validationResults[metricId];

export const selectCalculationCache = (state: { metrics: MetricState }, metricId: string) =>
  state.metrics.calculationCache[metricId];

export const selectMetricsByType = createSelector(
  [selectMetricDefinitions, (_, type: MetricType) => type],
  (definitions, type) => definitions.filter(def => def.type === type)
);

export const selectBatchOperationStatus = (state: { metrics: MetricState }) =>
  state.metrics.batchOperations;

export const selectIsLoading = (state: { metrics: MetricState }) =>
  Object.values(state.metrics.loading).some(loading => loading);

// Export actions and reducer
export const { invalidateCache, clearValidationResults, resetBatchOperations } = metricSlice.actions;
export default metricSlice.reducer;