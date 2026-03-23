import { Router } from 'express';
import {
  getAuditById,
  getAgentTrustScore,
  getAuditsByAgent,
  listAudits,
} from '../services/audit.service';

const router = Router();

router.get('/', (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const auditor = req.query.auditor as string | undefined;
    const targetAgent = req.query.target_agent as string | undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const offset = req.query.offset != null ? Number(req.query.offset) : undefined;

    const data = listAudits({ status, auditor, targetAgent, limit, offset });
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/agent/:address/score', (req, res) => {
  try {
    const { address } = req.params;
    const data = getAgentTrustScore(address);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/agent/:address/audits', (req, res) => {
  try {
    const { address } = req.params;
    const data = getAuditsByAgent(address);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.get('/:auditId', (req, res) => {
  try {
    const { auditId } = req.params;
    const row = getAuditById(auditId);
    if (!row) {
      res.status(404).json({ success: false, error: 'audit not found' });
      return;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
