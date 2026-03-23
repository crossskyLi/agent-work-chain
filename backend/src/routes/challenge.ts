import { Router } from 'express';
import { createChallenge, evaluateChallenge } from '../services/challenge.service';

const router = Router();

router.post('/', (req, res) => {
  try {
    const { targetAgent, challengeType, prompt } = req.body ?? {};
    if (typeof targetAgent !== 'string' || !targetAgent.trim()) {
      res.status(400).json({ success: false, error: 'targetAgent is required' });
      return;
    }
    if (typeof challengeType !== 'string' || !challengeType.trim()) {
      res.status(400).json({ success: false, error: 'challengeType is required' });
      return;
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ success: false, error: 'prompt is required' });
      return;
    }

    const data = createChallenge(targetAgent.trim(), challengeType.trim(), prompt.trim());
    res.status(201).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/:auditId/evaluate', (req, res) => {
  try {
    const { auditId } = req.params;
    const { score, report } = req.body ?? {};

    if (typeof score !== 'number' || Number.isNaN(score)) {
      res.status(400).json({ success: false, error: 'score must be a number' });
      return;
    }
    if (score < 0 || score > 100) {
      res.status(400).json({ success: false, error: 'score must be between 0 and 100' });
      return;
    }
    if (typeof report !== 'string') {
      res.status(400).json({ success: false, error: 'report must be a string' });
      return;
    }

    const result = evaluateChallenge(auditId, score, report);
    if (result.error) {
      const status = result.error === 'audit not found' ? 404 : 400;
      res.status(status).json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
