// @ts-check
import { check, sleep } from 'k6';  // k6 v0.45.0
import http from 'k6/http';  // k6 v0.45.0

// Base configuration
const BASE_URL = 'http://localhost:3000/api/v1/auth';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'testPassword123';
const OAUTH_CLIENT_ID = 'google-oauth-client-id';
const OAUTH_CLIENT_SECRET = 'google-oauth-client-secret';

// Performance thresholds based on technical specifications
export const options = {
  scenarios: {
    oauth_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 500 },  // Increase to 500 users
        { duration: '2m', target: 1000 }, // Peak load of 1000 users
        { duration: '1m', target: 0 },    // Scale down
      ],
      gracefulRampDown: '30s',
    },
    session_management: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete within 200ms
    http_req_failed: ['rate<0.01'],   // Less than 1% error rate
    'session_creation_rate': ['rate>=0.95'], // 95% success rate for session creation
    'concurrent_sessions': ['value<4'],      // Max 3 concurrent sessions per user
  },
};

// Test data setup
export function setup() {
  // Initialize test users with different roles
  const testUsers = {
    admin: {
      email: 'admin@example.com',
      role: 'ADMIN',
    },
    analyst: {
      email: 'analyst@example.com',
      role: 'ANALYST',
    },
    user: {
      email: 'user@example.com',
      role: 'USER',
    },
  };

  // OAuth configuration
  const oauthConfig = {
    clientId: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
    redirectUri: `${BASE_URL}/callback`,
    scope: 'profile email',
  };

  // Session configuration
  const sessionConfig = {
    maxConcurrentSessions: 3,
    idleTimeout: 30 * 60, // 30 minutes in seconds
    maxSessionDuration: 30 * 24 * 60 * 60, // 30 days in seconds
  };

  return {
    testUsers,
    oauthConfig,
    sessionConfig,
  };
}

// OAuth authentication scenario
function oauthScenario(oauthConfig) {
  const authUrl = `${BASE_URL}/oauth/google`;
  
  // Initiate OAuth flow
  const authResponse = http.get(authUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'oauth_initiate' },
  });

  check(authResponse, {
    'oauth initiation successful': (r) => r.status === 302,
    'redirect url present': (r) => r.headers['Location'] !== undefined,
  });

  // Simulate OAuth consent and code exchange
  const tokenResponse = http.post(`${BASE_URL}/oauth/token`, {
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret,
    grant_type: 'authorization_code',
    code: 'simulated_auth_code',
    redirect_uri: oauthConfig.redirectUri,
  });

  check(tokenResponse, {
    'token exchange successful': (r) => r.status === 200,
    'access token present': (r) => r.json('access_token') !== undefined,
    'token response time': (r) => r.timings.duration < 200,
  });

  return tokenResponse.json();
}

// Concurrent session testing
function concurrentSessionScenario(userId) {
  const sessions = [];
  
  // Attempt to create multiple sessions
  for (let i = 0; i < 4; i++) {
    const sessionResponse = http.post(`${BASE_URL}/sessions`, {
      userId: userId,
      deviceInfo: `device_${i}`,
    });

    sessions.push(sessionResponse);
    sleep(1); // Brief delay between session creation attempts
  }

  // Validate session limit enforcement
  check(sessions, {
    'max concurrent sessions enforced': (responses) => {
      const activeSessions = responses.filter(r => r.status === 200);
      return activeSessions.length <= 3;
    },
    'session creation performance': (responses) => {
      return responses.every(r => r.timings.duration < 200);
    },
  });

  return sessions;
}

// Main test execution
export default function(data) {
  const { testUsers, oauthConfig, sessionConfig } = data;
  
  // Test group for OAuth authentication
  group('OAuth Authentication', () => {
    const tokens = oauthScenario(oauthConfig);
    
    check(tokens, {
      'oauth flow completed': (t) => t.access_token !== undefined,
      'tokens valid': (t) => t.expires_in > 0,
    });
  });

  // Test group for session management
  group('Session Management', () => {
    const userId = 'test-user-id';
    const sessionResults = concurrentSessionScenario(userId);
    
    // Test session timeout
    sleep(sessionConfig.idleTimeout);
    
    const sessionCheckResponse = http.get(`${BASE_URL}/sessions/${userId}/active`);
    check(sessionCheckResponse, {
      'session timeout enforced': (r) => r.status === 401,
    });
  });

  // Test group for role-based access
  group('Role-Based Access', () => {
    Object.entries(testUsers).forEach(([role, user]) => {
      const accessResponse = http.get(`${BASE_URL}/permissions`, {
        headers: { 'X-User-Role': user.role },
      });

      check(accessResponse, {
        [`${role} permissions correct`]: (r) => {
          const permissions = r.json();
          return permissions.role === user.role;
        },
      });
    });
  });

  // Simulate realistic user behavior
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

// Cleanup function
export function teardown(data) {
  // Cleanup test sessions and temporary data
  const cleanupResponse = http.delete(`${BASE_URL}/test-cleanup`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(cleanupResponse, {
    'cleanup successful': (r) => r.status === 200,
  });
}