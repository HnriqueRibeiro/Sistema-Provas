import { createHash } from "node:crypto";
import { Request, RequestHandler } from "express";

interface RateLimitOptions {
  namespace: string;
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function fingerprintRateLimitValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const {
    namespace,
    windowMs,
    max,
    keyGenerator = (req) => req.ip || "unknown",
    message = "Muitas tentativas. Tente novamente mais tarde.",
  } = options;

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const rawKey = keyGenerator(req) || "unknown";
    const key = `${namespace}:${rawKey}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ message });
      return;
    }

    next();
  };
}
