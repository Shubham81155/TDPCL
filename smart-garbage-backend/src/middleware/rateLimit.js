// src/middleware/rateLimit.js
// Reusable in-memory rate limiter with periodic cleanup of expired entries.

const defaultKey = (req) => `${req.ip}:${req.baseUrl || ''}${req.path}`;

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyFn = defaultKey,
  skipSuccessful = false, // do not count responses with status < 400
  skip = null, // optional (req) => boolean
  message = 'Too many attempts. Try again later.',
  cleanupIntervalMs = Math.max(1000, Math.min(windowMs, 60 * 1000)),
} = {}) {
  const store = new Map(); // key -> { count, reset }

  const cleanup = (now = Date.now()) => {
    for (const [k, e] of store) if (now > e.reset) store.delete(k);
  };
  const timer = setInterval(cleanup, cleanupIntervalMs);
  if (timer.unref) timer.unref();

  const middleware = (req, res, next) => {
    if (skip && skip(req)) return next();
    const key = keyFn(req);
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs };
      store.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.reset - now) / 1000))));
      return res.status(429).json({ success: false, error: message });
    }

    if (skipSuccessful) {
      res.on('finish', () => {
        if (res.statusCode < 400 && store.get(key) === entry && entry.count > 0) entry.count -= 1;
      });
    }
    next();
  };

  middleware.reset = (reqOrKey) => store.delete(typeof reqOrKey === 'string' ? reqOrKey : keyFn(reqOrKey));
  middleware.cleanup = cleanup;
  middleware.size = () => store.size;
  middleware.stop = () => clearInterval(timer);
  return middleware;
}

// Generous global API limiter: 300 req / 15 min per IP. Skipped under NODE_ENV=test.
const createGlobalApiLimiter = (opts = {}) =>
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    keyFn: (req) => req.ip,
    message: 'Too many requests. Try again later.',
    skip: () => process.env.NODE_ENV === 'test',
    ...opts,
  });

module.exports = { createRateLimiter, createGlobalApiLimiter };
