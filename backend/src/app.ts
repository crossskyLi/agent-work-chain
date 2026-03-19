import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import { globalLimiter, queryLimiter } from './middleware/rate-limit';
import { metricsMiddleware } from './observability/metrics';
import taskRoutes from './routes/tasks';
import agentRoutes from './routes/agents';
import eventRoutes from './routes/events';
import queryRoutes from './routes/query';
import billingRoutes from './routes/billing';
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';

const app = express();

// trust proxy when behind reverse proxy / load balancer
app.set('trust proxy', 1);

// --- security ---
app.use(helmet());
app.use(cors());

// --- parsing & compression ---
app.use(express.json({ limit: '1mb' }));
app.use(compression());

// --- observability ---
app.use(requestLogger);
app.use(metricsMiddleware);

// --- rate limiting ---
app.use(globalLimiter);

// --- static ---
app.use('/docs', express.static(path.join(__dirname, '..', '..', 'docs')));

// --- routes ---
app.use('/health', healthRoutes);
app.use('/metrics', metricsRoutes);
app.use('/v1/tasks', taskRoutes);
app.use('/v1/agents', agentRoutes);
app.use('/v1/events', eventRoutes);
app.use('/v1/query', queryLimiter, queryRoutes);
app.use('/v1/billing', billingRoutes);

// --- error handler (must be last) ---
app.use(errorHandler);

export default app;
