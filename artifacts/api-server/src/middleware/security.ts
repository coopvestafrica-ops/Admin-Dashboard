import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

// In-memory store for rate limiting and login attempts
// In production, use Redis for distributed rate limiting
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const requestCounts = new Map<string, { count: number; windowStart: number }>();

// Configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;
const MAX_REQUESTS_PER_MINUTE = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Rate limiting middleware - limits requests per IP
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIP(req);
  const now = Date.now();
  
  // Clean old entries periodically
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }
  
  // Get or create request count for this IP
  let requestData = requestCounts.get(ip);
  
  if (!requestData || now - requestData.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    requestData = { count: 1, windowStart: now };
    requestCounts.set(ip, requestData);
    next();
    return;
  }
  
  requestData.count++;
  
  if (requestData.count > MAX_REQUESTS_PER_MINUTE) {
    logger.warn({ ip, count: requestData.count }, 'Rate limit exceeded');
    res.status(429).json({
      error: 'Too many requests. Please wait a moment.',
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - requestData.windowStart)) / 1000)
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_MINUTE - requestData.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil((requestData.windowStart + RATE_LIMIT_WINDOW_MS) / 1000));
  
  next();
}

/**
 * Track login attempts and lock out after too many failures
 */
export async function trackLoginAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only track login attempts
  const isLoginRequest = req.path.includes('/auth/login') || req.path === '/auth/signin';
  
  if (!isLoginRequest) {
    next();
    return;
  }
  
  const ip = getClientIP(req);
  const email = req.body?.email?.toLowerCase();
  const key = email ? `${ip}:${email}` : ip;
  
  const now = Date.now();
  let attempt = loginAttempts.get(key);
  
  if (!attempt) {
    attempt = { count: 0, lastAttempt: now };
  }
  
  // Check if locked out
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const lockoutEnd = attempt.lastAttempt + (LOGIN_LOCKOUT_MINUTES * 60 * 1000);
    if (now < lockoutEnd) {
      const remainingMinutes = Math.ceil((lockoutEnd - now) / 60000);
      logger.warn({ ip, email, attempts: attempt.count }, 'Login blocked - too many attempts');
      res.status(429).json({
        error: `Too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        retryAfter: remainingMinutes * 60
      });
      return;
    } else {
      // Lockout expired, reset counter
      attempt = { count: 0, lastAttempt: now };
    }
  }
  
  // Store attempt data for later use
  (req as any)._loginAttemptKey = key;
  (req as any)._loginAttempt = attempt;
  
  next();
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(req: Request): void {
  const key = (req as any)._loginAttemptKey;
  let attempt = (req as any)._loginAttempt;
  
  if (!key) return;
  
  if (!attempt) {
    attempt = { count: 0, lastAttempt: Date.now() };
  }
  
  attempt.count++;
  attempt.lastAttempt = Date.now();
  loginAttempts.set(key, attempt);
  
  logger.info({ key, attempts: attempt.count }, 'Failed login attempt recorded');
}

/**
 * Clear login attempts on successful login
 */
export function clearLoginAttempts(req: Request): void {
  const key = (req as any)._loginAttemptKey;
  
  if (key) {
    loginAttempts.delete(key);
    logger.info({ key }, 'Login attempts cleared');
  }
}

/**
 * Log security events (suspicious activity)
 */
export function logSecurityEvent(type: string, details: Record<string, any>, req?: Request): void {
  const logData = {
    type,
    ...details,
    ip: req ? getClientIP(req) : undefined,
    userAgent: req?.headers['user-agent'],
    timestamp: new Date().toISOString()
  };
  
  logger.warn(logData, `Security event: ${type}`);
  
  // In production, you could also:
  // - Store in a security_events table
  // - Send alerts for critical events
  // - Integrate with SIEM systems
}

/**
 * Require re-authentication for sensitive actions
 */
export function requireReauth(allowedActions: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Actions that require re-authentication
    const sensitiveActions = [
      'withdraw',
      'delete-account',
      'change-pin',
      'change-password',
      ...allowedActions
    ];
    
    const action = req.body?.action || req.path;
    
    if (!sensitiveActions.some(a => action.includes(a))) {
      next();
      return;
    }
    
    // Check for recent authentication
    const recentAuth = req.headers['x-recent-auth'];
    const recentAuthTime = recentAuth ? parseInt(recentAuth as string) : 0;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (!recentAuth || (now - recentAuthTime) > fiveMinutes) {
      res.status(403).json({
        error: 'This action requires recent authentication. Please re-authenticate.',
        requireReauth: true
      });
      return;
    }
    
    next();
  };
}

// ─── Helper functions ───────────────────────────────────────────────────────────

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function cleanupOldEntries(): void {
  const now = Date.now();
  const windowThreshold = RATE_LIMIT_WINDOW_MS * 2;
  const loginThreshold = LOGIN_LOCKOUT_MINUTES * 60 * 1000 * 2;
  
  // Clean request counts
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > windowThreshold) {
      requestCounts.delete(key);
    }
  }
  
  // Clean login attempts
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > loginThreshold) {
      loginAttempts.delete(key);
    }
  }
}