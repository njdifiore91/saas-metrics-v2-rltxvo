/**
 * Root Redux Store Configuration
 * Configures the global store with all feature slices, middleware, and type-safe hooks
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // ^8.1.0

// Import feature slice reducers
import authReducer from './auth.slice';
import benchmarkReducer from './benchmark.slice';
import metricReducer from './metric.slice';
import reportReducer from './report.slice';

/**
 * Configure the Redux store with all feature reducers and middleware
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    benchmark: benchmarkReducer,
    metrics: metricReducer,
    reports: reportReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializability checks
        ignoredActions: ['report/generateReport/fulfilled'],
        // Ignore these field paths in state for serializability checks
        ignoredPaths: [
          'metrics.calculationCache',
          'benchmark.cache',
          'reports.currentReport'
        ]
      },
      thunk: {
        extraArgument: undefined
      }
    }),
  devTools: process.env.NODE_ENV !== 'production'
});

// Extract root state and dispatch types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Type-safe dispatch hook for dispatching actions
 * Usage: const dispatch = useAppDispatch();
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Type-safe selector hook for accessing state
 * Usage: const data = useAppSelector(state => state.feature.data);
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;