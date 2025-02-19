import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { IReport, IReportConfig, ReportFormat } from '../interfaces/report.interface';
import { reportService } from '../services/report.service';

// State interface
interface ReportState {
  reports: IReport[];
  currentReport: IReport | null;
  loading: {
    generate: boolean;
    fetch: boolean;
    export: boolean;
    delete: boolean;
  };
  progress: {
    reportId: string | null;
    percent: number;
    status: 'pending' | 'generating' | 'exporting' | 'completed' | 'error' | null;
  };
  error: {
    generate: string | null;
    fetch: string | null;
    export: string | null;
    delete: string | null;
  };
  cache: {
    lastFetch: number | null;
    invalidated: boolean;
  };
}

// Initial state
const initialState: ReportState = {
  reports: [],
  currentReport: null,
  loading: {
    generate: false,
    fetch: false,
    export: false,
    delete: false
  },
  progress: {
    reportId: null,
    percent: 0,
    status: null
  },
  error: {
    generate: null,
    fetch: null,
    export: null,
    delete: null
  },
  cache: {
    lastFetch: null,
    invalidated: false
  }
};

// Async thunks
export const generateReport = createAsyncThunk(
  'report/generate',
  async (config: IReportConfig, { rejectWithValue }) => {
    try {
      return await reportService.generateReport(config);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchReports = createAsyncThunk(
  'report/fetchAll',
  async (forceRefresh: boolean = false, { getState, rejectWithValue }) => {
    const state = getState() as { report: ReportState };
    const now = Date.now();
    const cacheAge = state.report.cache.lastFetch ? now - state.report.cache.lastFetch : Infinity;
    
    // Return cached data if valid and no force refresh
    if (!forceRefresh && cacheAge < 15 * 60 * 1000 && !state.report.cache.invalidated) {
      return state.report.reports;
    }

    try {
      const reports = await reportService.getAllReports();
      return reports;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const exportReport = createAsyncThunk(
  'report/export',
  async ({ reportId, format }: { reportId: string; format: ReportFormat }, { rejectWithValue }) => {
    try {
      await reportService.exportReport(reportId, format);
      return reportId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteReport = createAsyncThunk(
  'report/delete',
  async (reportId: string, { rejectWithValue }) => {
    try {
      await reportService.deleteReport(reportId);
      return reportId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice definition
const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    setCurrentReport: (state, action: PayloadAction<IReport | null>) => {
      state.currentReport = action.payload;
    },
    updateProgress: (state, action: PayloadAction<{ reportId: string; percent: number; status: ReportState['progress']['status'] }>) => {
      state.progress = action.payload;
    },
    clearErrors: (state) => {
      state.error = initialState.error;
    },
    invalidateCache: (state) => {
      state.cache.invalidated = true;
    },
    resetProgress: (state) => {
      state.progress = initialState.progress;
    }
  },
  extraReducers: (builder) => {
    // Generate report
    builder
      .addCase(generateReport.pending, (state) => {
        state.loading.generate = true;
        state.error.generate = null;
        state.progress = {
          reportId: null,
          percent: 0,
          status: 'generating'
        };
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.loading.generate = false;
        state.reports.unshift(action.payload);
        state.currentReport = action.payload;
        state.progress = {
          reportId: action.payload.id,
          percent: 100,
          status: 'completed'
        };
        state.cache.invalidated = true;
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.loading.generate = false;
        state.error.generate = action.payload as string;
        state.progress = {
          reportId: null,
          percent: 0,
          status: 'error'
        };
      });

    // Fetch reports
    builder
      .addCase(fetchReports.pending, (state) => {
        state.loading.fetch = true;
        state.error.fetch = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.reports = action.payload;
        state.cache.lastFetch = Date.now();
        state.cache.invalidated = false;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.loading.fetch = false;
        state.error.fetch = action.payload as string;
      });

    // Export report
    builder
      .addCase(exportReport.pending, (state) => {
        state.loading.export = true;
        state.error.export = null;
        state.progress = {
          reportId: null,
          percent: 0,
          status: 'exporting'
        };
      })
      .addCase(exportReport.fulfilled, (state, action) => {
        state.loading.export = false;
        state.progress = {
          reportId: action.payload,
          percent: 100,
          status: 'completed'
        };
      })
      .addCase(exportReport.rejected, (state, action) => {
        state.loading.export = false;
        state.error.export = action.payload as string;
        state.progress = {
          reportId: null,
          percent: 0,
          status: 'error'
        };
      });

    // Delete report
    builder
      .addCase(deleteReport.pending, (state) => {
        state.loading.delete = true;
        state.error.delete = null;
      })
      .addCase(deleteReport.fulfilled, (state, action) => {
        state.loading.delete = false;
        state.reports = state.reports.filter(report => report.id !== action.payload);
        if (state.currentReport?.id === action.payload) {
          state.currentReport = null;
        }
        state.cache.invalidated = true;
      })
      .addCase(deleteReport.rejected, (state, action) => {
        state.loading.delete = false;
        state.error.delete = action.payload as string;
      });
  }
});

// Export actions and reducer
export const {
  setCurrentReport,
  updateProgress,
  clearErrors,
  invalidateCache,
  resetProgress
} = reportSlice.actions;

export default reportSlice.reducer;