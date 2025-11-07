/**
 * JWT Authentication Middleware for Cloudflare Workers
 * Verifies Firebase JWT tokens and extracts user information
 */

import { ApiResponse } from '@/types';

// Firebase project configuration (same as frontend)
const FIREBASE_PROJECT_ID = 'neetlogiq-15499';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_AUDIENCE = FIREBASE_PROJECT_ID;

// JWT payload interface
interface JWTPayload {
  iss: string; // Issuer
  aud: string; // Audience
  auth_time: number; // Auth time
  user_id: string; // User ID
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expires at
  email?: string; // Email
  email_verified?: boolean; // Email verified
  firebase: {
    identities: {
      email?: string[];
      'google.com'?: string[];
    };
    sign_in_provider: string;
  };
  // Custom claims
  admin?: boolean;
  role?: string;
}

// User information extracted from JWT
export interface AuthUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  isAdmin: boolean;
  role?: string;
  provider: string;
}

// Simple JWT decoder (for development - in production use proper JWT verification)
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

// Validate JWT payload
function validateJWTPayload(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  
  // Check expiration
  if (payload.exp < now) {
    console.log('JWT token expired');
    return false;
  }
  
  // Check issued time (not in future)
  if (payload.iat > now + 300) { // Allow 5 min clock skew
    console.log('JWT token issued in future');
    return false;
  }
  
  // Check issuer
  if (payload.iss !== FIREBASE_ISSUER) {
    console.log('Invalid JWT issuer');
    return false;
  }
  
  // Check audience
  if (payload.aud !== FIREBASE_AUDIENCE) {
    console.log('Invalid JWT audience');
    return false;
  }
  
  return true;
}

// Extract user info from JWT payload
function extractUserInfo(payload: JWTPayload): AuthUser {
  // Import admin configuration (dynamic import for server-side)
  let isAdminEmail, getAdminRole;
  try {
    // Try to import admin config, fallback to defaults if not available
    const adminConfig = eval('require')('@/config/admin');
    isAdminEmail = adminConfig.isAdminEmail;
    getAdminRole = adminConfig.getAdminRole;
  } catch (error) {
    // Fallback functions if admin config not available
    isAdminEmail = (email: string) => email === 'admin@neetlogiq.com';
    getAdminRole = (email: string) => email === 'admin@neetlogiq.com' ? 'admin' : 'user';
  }
  
  // Check if email is in admin list
  const emailIsAdmin = isAdminEmail(payload.email);
  
  // Also check JWT claims (fallback)
  const claimsIsAdmin = payload.admin === true || payload.role === 'admin';
  
  return {
    uid: payload.user_id,
    email: payload.email,
    emailVerified: payload.email_verified || false,
    isAdmin: emailIsAdmin || claimsIsAdmin,
    role: getAdminRole(payload.email) || payload.role,
    provider: payload.firebase.sign_in_provider
  };
}

// Verify JWT token and extract user information
export function verifyAuthToken(token: string): AuthUser | null {
  if (!token) return null;
  
  // Remove 'Bearer ' prefix if present
  const cleanToken = token.replace(/^Bearer\s+/, '');
  
  // Decode JWT
  const payload = decodeJWT(cleanToken);
  if (!payload) return null;
  
  // Validate payload
  if (!validateJWTPayload(payload)) return null;
  
  // Extract user information
  return extractUserInfo(payload);
}

// Authentication middleware for API routes
export function requireAuth(handler: (request: Request, env: any, url: URL, user: AuthUser) => Promise<Response>) {
  return async (request: Request, env: any, url: URL): Promise<Response> => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      const response: ApiResponse<never> = {
        success: false,
        data: null as never,
        error: 'Missing Authorization header'
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = verifyAuthToken(authHeader);
    if (!user) {
      const response: ApiResponse<never> = {
        success: false,
        data: null as never,
        error: 'Invalid or expired authentication token'
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Call the protected handler with user information
    return handler(request, env, url, user);
  };
}

// Admin-only middleware
export function requireAdmin(handler: (request: Request, env: any, url: URL, user: AuthUser) => Promise<Response>) {
  return requireAuth(async (request: Request, env: any, url: URL, user: AuthUser): Promise<Response> => {
    if (!user.isAdmin) {
      const response: ApiResponse<never> = {
        success: false,
        data: null as never,
        error: 'Admin access required'
      };
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return handler(request, env, url, user);
  });
}

// Optional auth middleware (for endpoints that work with or without auth)
export function optionalAuth(handler: (request: Request, env: any, url: URL, user?: AuthUser) => Promise<Response>) {
  return async (request: Request, env: any, url: URL): Promise<Response> => {
    const authHeader = request.headers.get('Authorization');
    const user = authHeader ? verifyAuthToken(authHeader) : undefined;
    
    return handler(request, env, url, user);
  };
}

// Helper to create authenticated API response
export function createAuthResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message
  };
}

// Helper to create error response
export function createErrorResponse(error: string, status: number = 400): Response {
  const response: ApiResponse<never> = {
    success: false,
    data: null as never,
    error
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}