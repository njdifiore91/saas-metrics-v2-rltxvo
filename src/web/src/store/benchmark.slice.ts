import { createSlice, createAsyncThunk, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit';
import { IBenchmarkData, IBenchmarkComparison } from '../interfaces/benchmark.interface';
import { benchmarkService } from '../services/benchmark.service';
import { ERROR_CODES } from '../constants/api.constants';

// Define the state structure
interface BenchmarkState {
  entities: Record<string, IBenchmarkData>;
  comparisons: Record<string, IBenchmarkComparison>;
  revenueRanges: Array<{ id: string; name: string }>;
  loadingStates: {
    fetchBenchmark: boolean;
    compareMetric: boolean;
  };
  errors: {
    fetchBenchmark: string | null;
    compareMetric: string | null;
  };
  cache: {
    timestamp: number | null;
    data: Record<string, {
      data: IBenchmarkData;
      expires: number;
    }>;
  };
}

// Create entity adapter for normalized state management
const benchmarkAdapter = createEntityAdapter<IBenchmarkData>({
  selectId: (benchmark) => benchmark.id,
  sortComparer: (a, b) => a.metricId.localeCompare(b.metricId)
});

// Initial state
const initialState: BenchmarkState = {
  entities: {},
  comparisons: {},
  revenueRanges: [],
  loadingStates: {
    fetchBenchmark: false,
    compareMetric: false
  },
  errors: {
    fetchBenchmark: null,
    compareMetric: null
  },
  cache: {
    timestamp: null,
    data: {}
  }
};

// Async thunks
export const fetchBenchmarkData = createAsyncThunk(
  'benchmark/fetchBenchmarkData',
  async ({ 
    metricId, 
    revenueRangeId, 
    forceRefresh = false 
  }: { 
    metricId: string; 
    revenueRangeId: string; 
    forceRefresh?: boolean;
  }, { rejectWithValue }) => {
    try {
      const benchmarkData = await benchmarkService.getBenchmarkData(
        metricId,
        revenueRangeId
      );
      return benchmarkData;
    } catch (error) {
      return rejectWithValue({
        code: ERROR_CODES.DATA.INVALID_VALUE,
        message: `Failed to fetch benchmark data: ${error.message}`
      });
    }
  }
);

export const compareMetric = createAsyncThunk(
  'benchmark/compareMetric',
  async ({ 
    metricId, 
    revenueRangeId, 
    companyValue,
    includeHistory = false
  }: { 
    metricId: string; 
    revenueRangeId: string; 
    companyValue: number;
    includeHistory?: boolean;
  }, { rejectWithValue }) => {
    try {
      const comparison = await benchmarkService.compareMetric(
        metricId,
        revenueRangeId,
        companyValue
      );
      return comparison;
    } catch (error) {
      return rejectWithValue({
        code: ERROR_CODES.DATA.VALIDATION_ERROR,
        message: `Failed to compare metric: ${error.message}`
      });
    }
  }
);

// Create the slice
const benchmarkSlice = createSlice({
  name: 'benchmark',
  initialState,
  reducers: {
    clearBenchmarkErrors: (state) => {
      state.errors.fetchBenchmark = null;
      state.errors.compareMetric = null;
    },
    clearBenchmarkCache: (state) => {
      state.cache = {
        timestamp: null,
        data: {}
      };
    },
    updateRevenueRanges: (state, action: PayloadAction<Array<{ id: string; name: string }>>) => {
      state.revenueRanges = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch benchmark data
      .addCase(fetchBenchmarkData.pending, (state) => {
        state.loadingStates.fetchBenchmark = true;
        state.errors.fetchBenchmark = null;
      })
      .addCase(fetchBenchmarkData.fulfilled, (state, action) => {
        state.loadingStates.fetchBenchmark = false;
        state.entities[action.payload.id] = action.payload;
        state.cache.data[`${action.payload.metricId}-${action.payload.revenueRangeId}`] = {
          data: action.payload,
          expires: Date.now() + (15 * 60 * 1000) // 15 minutes cache
        };
        state.cache.timestamp = Date.now();
      })
      .addCase(fetchBenchmarkData.rejected, (state, action) => {
        state.loadingStates.fetchBenchmark = false;
        state.errors.fetchBenchmark = action.payload as string;
      })
      // Compare metric
      .addCase(compareMetric.pending, (state) => {
        state.loadingStates.compareMetric = true;
        state.errors.compareMetric = null;
      })
      .addCase(compareMetric.fulfilled, (state, action) => {
        state.loadingStates.compareMetric = false;
        state.comparisons[`${action.payload.metric.id}-${action.payload.revenueRange.id}`] = action.payload;
      })
      .addCase(compareMetric.rejected, (state, action) => {
        state.loadingStates.compareMetric = false;
        state.errors.compareMetric = action.payload as string;
      });
  }
});

// Export actions
export const { 
  clearBenchmarkErrors, 
  clearBenchmarkCache, 
  updateRevenueRanges 
} = benchmarkSlice.actions;

// Export selectors
export const selectBenchmarkData = (state: { benchmark: BenchmarkState }, id: string) => 
  state.benchmark.entities[id];

export const selectBenchmarkComparison = (
  state: { benchmark: BenchmarkState }, 
  metricId: string, 
  revenueRangeId: string
) => state.benchmark.comparisons[`${metricId}-${revenueRangeId}`];

export const selectBenchmarkLoadingState = (
  state: { benchmark: BenchmarkState }, 
  operation: keyof BenchmarkState['loadingStates']
) => state.benchmark.loadingStates[operation];

export const selectBenchmarkError = (
  state: { benchmark: BenchmarkState }, 
  operation: keyof BenchmarkState['errors']
) => state.benchmark.errors[operation];

export const selectRevenueRanges = (state: { benchmark: BenchmarkState }) => 
  state.benchmark.revenueRanges;

// Export reducer
export default benchmarkSlice.reducer;