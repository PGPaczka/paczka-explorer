import { Request, Response, NextFunction } from 'express';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_UPLOAD_MAX, RATE_LIMIT_LOGIN_MAX } from './config';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets: Map<string, RateBucket> = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 300000);

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function checkLimit(key: string, max: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** General rate limiter for all API requests */
export function rateLimitGeneral(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const { allowed, remaining, resetAt } = checkLimit(`general:${ip}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());

  if (!allowed) {
    res.status(429).json({ detail: 'Zbyt wiele zapytań. Spróbuj ponownie za chwilę.' });
    return;
  }
  next();
}

/** Stricter rate limiter for upload endpoint */
export function rateLimitUpload(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const { allowed, remaining } = checkLimit(`upload:${ip}`, RATE_LIMIT_UPLOAD_MAX, RATE_LIMIT_WINDOW_MS);

  if (!allowed) {
    res.status(429).json({ detail: 'Zbyt wiele uploadów. Spróbuj ponownie za minutę.' });
    return;
  }
  next();
}

/** Strictest rate limiter for login endpoint */
export function rateLimitLogin(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const { allowed, remaining } = checkLimit(`login:${ip}`, RATE_LIMIT_LOGIN_MAX, RATE_LIMIT_WINDOW_MS);

  if (!allowed) {
    res.status(429).json({ detail: 'Zbyt wiele prób logowania. Spróbuj ponownie za minutę.' });
    return;
  }
  next();
}
