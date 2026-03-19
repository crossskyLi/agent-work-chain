import { Router } from 'express';
import { metricsHandler } from '../observability/metrics';

const router = Router();

router.get('/', metricsHandler);

export default router;
