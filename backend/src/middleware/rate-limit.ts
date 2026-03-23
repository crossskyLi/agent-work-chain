import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
  skip: (req) => req.path === '/health' || req.path === '/health/ready' || req.path === '/metrics',
});
