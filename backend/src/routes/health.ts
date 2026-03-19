import { Router } from 'express';
import { getDb } from '../db';
import { asyncHandler } from '../middleware/error-handler';
import { getPgReader, getPgWriter, isPostgresEnabled } from '../db/postgres';
import { getRedisClient, isRedisEnabled } from '../cache/redis';

const startedAt = Date.now();

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const taskCount = (
      db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    ).count;
    const agentCount = (
      db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number }
    ).count;

    res.json({
      status: 'ok',
      tasks: taskCount,
      agents: agentCount,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    });
  }),
);

router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const db = getDb();

    try {
      db.prepare('SELECT 1').get();
    } catch {
      res.status(503).json({ status: 'not_ready', reason: 'database unavailable' });
      return;
    }

    const taskCount = (
      db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    ).count;
    const agentCount = (
      db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number }
    ).count;
    const eventCount = (
      db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number }
    ).count;

    const latestEvent = db
      .prepare('SELECT MAX(created_at) as ts FROM events')
      .get() as { ts: number | null };

    let pg: { enabled: boolean; writer: boolean; reader: boolean } = {
      enabled: false,
      writer: false,
      reader: false,
    };
    if (isPostgresEnabled()) {
      const writer = getPgWriter();
      const reader = getPgReader();
      const writerOk = writer ? await writer.query('SELECT 1').then(() => true).catch(() => false) : false;
      const readerOk = reader ? await reader.query('SELECT 1').then(() => true).catch(() => false) : false;
      pg = { enabled: true, writer: writerOk, reader: readerOk };
    }

    let redis = { enabled: false, ready: false };
    if (isRedisEnabled()) {
      const client = await getRedisClient();
      redis = { enabled: true, ready: Boolean(client?.isOpen) };
    }

    res.json({
      status: 'ready',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      db: {
        writable: true,
        tasks: taskCount,
        agents: agentCount,
        events: eventCount,
        lastEventAt: latestEvent.ts,
      },
      postgres: pg,
      redis,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  }),
);

export default router;
