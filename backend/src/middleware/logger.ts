import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const headerId = req.headers['x-request-id'];
    const requestId = typeof headerId === 'string' && headerId.trim()
      ? headerId
      : crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: (req as { id?: string }).id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
