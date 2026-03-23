import { Router } from 'express';
import { getAuditorStats, listAuditors } from '../services/audit.service';

const router = Router();

router.get('/', (req, res) => {
  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : 100;
    const offset = req.query.offset != null ? Number(req.query.offset) : 0;
    const data = listAuditors(limit, offset);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/:address', (req, res) => {
  try {
    const { address } = req.params;
    const data = getAuditorStats(address);
    if (!data) {
      res.status(404).json({ success: false, error: 'auditor not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
