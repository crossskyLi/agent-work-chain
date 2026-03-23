import { Router } from 'express';
import { getTrustLeaderboard, getTrustScoreBreakdown } from '../services/audit.service';

const router = Router();

router.get('/leaderboard', (req, res) => {
  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : 20;
    const data = getTrustLeaderboard(limit);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/:address', (req, res) => {
  try {
    const { address } = req.params;
    const data = getTrustScoreBreakdown(address);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
