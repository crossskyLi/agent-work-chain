import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import { globalLimiter } from './middleware/rate-limit';
import { metricsMiddleware } from './observability/metrics';
import auditRoutes from './routes/audit';
import challengeRoutes from './routes/challenge';
import trustScoreRoutes from './routes/trust-score';
import auditorsRoutes from './routes/auditors';
import certificationsRoutes, { overviewRouter } from './routes/certifications';
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '1mb' }));
app.use(compression());

app.use(requestLogger);
app.use(metricsMiddleware);

app.use(globalLimiter);

app.use('/docs', express.static(path.join(__dirname, '..', '..', 'docs')));

app.use('/health', healthRoutes);
app.use('/metrics', metricsRoutes);
app.use('/v1/audits', auditRoutes);
app.use('/v1/challenges', challengeRoutes);
app.use('/v1/trust-score', trustScoreRoutes);
app.use('/v1/auditors', auditorsRoutes);
app.use('/v1/certifications', certificationsRoutes);
app.use('/v1/audit-protocol', overviewRouter);

app.use(errorHandler);

export default app;
