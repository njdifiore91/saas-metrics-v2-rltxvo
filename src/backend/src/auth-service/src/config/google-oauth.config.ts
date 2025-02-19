import { OAuth2Client } from 'google-auth-library'; // v8.0.0
import { createHash, randomBytes } from 'crypto';
import { AUTH_ERRORS } from '../../shared/constants/error-codes';

/**
 * Interface defining Google OAuth configuration settings
 */
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Interface for typed Google user profile data
 */
interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

/**
 * Validate required environment variables for Google OAuth
 * @throws Error if required environment variables are missing
 */
const validateEnvironmentVars = (): void => {
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'STATE_SECRET'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
};

/**
 * Google OAuth configuration object with validated settings
 */
export const googleOAuthConfig: GoogleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['openid', 'profile', 'email']
};

/**
 * Creates and configures a new Google OAuth 2.0 client instance
 * @returns Configured OAuth2Client instance
 * @throws Error if configuration validation fails
 */
export const createGoogleOAuthClient = (): OAuth2Client => {
  validateEnvironmentVars();

  const client = new OAuth2Client({
    clientId: googleOAuthConfig.clientId,
    clientSecret: googleOAuthConfig.clientSecret,
    redirectUri: googleOAuthConfig.redirectUri
  });

  return client;
};

/**
 * Generates a secure state parameter for CSRF protection
 * @returns Hashed state string
 */
const generateSecureState = (): string => {
  const stateBuffer = randomBytes(32);
  const stateParam = stateBuffer.toString('hex');
  
  return createHash('sha256')
    .update(stateParam + process.env.STATE_SECRET!)
    .digest('hex');
};

/**
 * Generates Google OAuth authorization URL with CSRF protection
 * @param client Configured OAuth2Client instance
 * @returns Authorization URL with secure state parameter
 */
export const getGoogleAuthUrl = (client: OAuth2Client): string => {
  const state = generateSecureState();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: googleOAuthConfig.scopes,
    state,
    prompt: 'consent',
    include_granted_scopes: true
  });

  return authUrl;
};

/**
 * Validates state parameter to prevent CSRF attacks
 * @param state State parameter from OAuth callback
 * @returns boolean indicating state validity
 */
const validateState = (state: string): boolean => {
  const expectedHash = createHash('sha256')
    .update(state + process.env.STATE_SECRET!)
    .digest('hex');

  return state === expectedHash;
};

/**
 * Validates Google OAuth authorization code and retrieves user profile
 * @param client Configured OAuth2Client instance
 * @param code Authorization code from OAuth callback
 * @param state State parameter from OAuth callback
 * @returns Promise resolving to tokens and user profile
 * @throws Error with RFC 7807 compliant details on validation failure
 */
export const validateGoogleAuthCode = async (
  client: OAuth2Client,
  code: string,
  state: string
): Promise<{tokens: any, profile: GoogleUserProfile}> => {
  // Validate state parameter
  if (!validateState(state)) {
    throw {
      type: 'https://auth.api.startup-metrics.com/errors/invalid-state',
      status: 401,
      code: AUTH_ERRORS.AUTH001,
      message: 'Invalid state parameter - possible CSRF attack',
      details: { state },
      instance: `/auth/google/callback?state=${state}`
    };
  }

  try {
    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: googleOAuthConfig.clientId
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Failed to verify ID token');
    }

    // Construct typed user profile
    const profile: GoogleUserProfile = {
      id: payload.sub!,
      email: payload.email!,
      name: payload.name!,
      picture: payload.picture!,
      verified_email: payload.email_verified!
    };

    return { tokens, profile };
  } catch (error) {
    throw {
      type: 'https://auth.api.startup-metrics.com/errors/auth-failed',
      status: 401,
      code: AUTH_ERRORS.AUTH002,
      message: 'Failed to validate OAuth authorization code',
      details: { error },
      instance: `/auth/google/callback?code=${code}`
    };
  }
};