import { lazy, Suspense } from 'react'; // v18.2.0
import { RouteObject } from 'react-router-dom'; // v6.4.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { UserRole } from '../types/api.types';
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * Extended route configuration interface with metadata and security controls
 */
interface AppRoute extends RouteObject {
  isProtected: boolean;
  allowedRoles?: UserRole[];
  title: string;
  preload?: boolean;
  metadata: RouteMetadata;
}

/**
 * Additional route configuration metadata
 */
interface RouteMetadata {
  description?: string;
  breadcrumbs?: string[];
  trackAnalytics?: boolean;
  security?: {
    requireMFA?: boolean;
    rateLimit?: number;
  };
}

/**
 * Creates protected route with error boundary and loading state
 * @param route Route configuration
 */
const getProtectedRoute = (route: AppRoute): React.ReactNode => {
  const Component = route.element;

  // Set document title on route render
  document.title = `${route.title} | Startup Metrics Platform`;

  const wrappedComponent = (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div role="alert">
          <h3>Error loading {route.title}</h3>
          <pre>{error.message}</pre>
        </div>
      )}
    >
      <Suspense fallback={<LoadingSpinner size="large" overlay={true} />}>
        {Component}
      </Suspense>
    </ErrorBoundary>
  );

  if (route.isProtected) {
    return (
      <ProtectedRoute requiredRoles={route.allowedRoles}>
        {wrappedComponent}
      </ProtectedRoute>
    );
  }

  return wrappedComponent;
};

/**
 * Preloads route component for faster navigation
 * @param route Route to preload
 */
const preloadRoute = async (route: AppRoute): Promise<void> => {
  try {
    if (route.preload && typeof route.element === 'function') {
      await route.element();
    }
  } catch (error) {
    console.error(`Failed to preload route: ${route.path}`, error);
  }
};

/**
 * Application route configurations with enhanced metadata
 */
export const routes: AppRoute[] = [
  {
    path: '/login',
    element: lazy(() => import('../pages/LoginPage')),
    isProtected: false,
    title: 'Login',
    metadata: {
      description: 'Secure authentication portal',
      trackAnalytics: false,
      security: {
        rateLimit: 10 // Requests per minute
      }
    }
  },
  {
    path: '/',
    element: lazy(() => import('../pages/DashboardPage')),
    isProtected: true,
    allowedRoles: [UserRole.ADMIN, UserRole.ANALYST, UserRole.USER],
    title: 'Dashboard',
    preload: true,
    metadata: {
      description: 'Main dashboard with key metrics',
      breadcrumbs: ['Home'],
      trackAnalytics: true
    }
  },
  {
    path: '/metrics',
    element: lazy(() => import('../pages/MetricsPage')),
    isProtected: true,
    allowedRoles: [UserRole.ADMIN, UserRole.ANALYST, UserRole.USER],
    title: 'Metrics',
    metadata: {
      description: 'Detailed metric analysis',
      breadcrumbs: ['Home', 'Metrics'],
      trackAnalytics: true
    }
  },
  {
    path: '/admin',
    element: lazy(() => import('../pages/AdminPage')),
    isProtected: true,
    allowedRoles: [UserRole.ADMIN],
    title: 'Administration',
    metadata: {
      description: 'System administration',
      breadcrumbs: ['Home', 'Admin'],
      trackAnalytics: true,
      security: {
        requireMFA: true
      }
    }
  },
  {
    path: '/reports',
    element: lazy(() => import('../pages/ReportsPage')),
    isProtected: true,
    allowedRoles: [UserRole.ADMIN, UserRole.ANALYST],
    title: 'Reports',
    metadata: {
      description: 'Generate and view reports',
      breadcrumbs: ['Home', 'Reports'],
      trackAnalytics: true
    }
  },
  {
    path: '/unauthorized',
    element: lazy(() => import('../pages/UnauthorizedPage')),
    isProtected: false,
    title: 'Unauthorized',
    metadata: {
      description: 'Access denied',
      trackAnalytics: false
    }
  },
  {
    path: '*',
    element: lazy(() => import('../pages/NotFoundPage')),
    isProtected: false,
    title: 'Not Found',
    metadata: {
      description: 'Page not found',
      trackAnalytics: false
    }
  }
];

// Preload routes marked for preloading
routes.forEach(route => {
  if (route.preload) {
    preloadRoute(route);
  }
});

export default routes;