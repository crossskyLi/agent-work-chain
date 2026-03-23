import { Router } from 'express';
import { listCertifications, getProtocolOverview } from '../services/audit.service';

const router = Router();

router.get('/', (req, res) => {
  try {
    const agent = req.query.agent as string | undefined;
    const certType = req.query.cert_type as string | undefined;
    const data = listCertifications({ agent, certType });
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;

export const overviewRouter = Router();

overviewRouter.get('/overview', (_req, res) => {
  try {
    const data = getProtocolOverview();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});
