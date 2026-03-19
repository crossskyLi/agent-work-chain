import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error-handler';
import { validateQuery, taskQuerySchema } from '../middleware/validate';
import { cacheGetJson, cacheSetJson } from '../cache/redis';
import { findTaskById, listTasks } from '../db/task-reader';
import type { TaskQueryParams, TaskRow } from '../types';

const router = Router();

function buildTaskListCacheKey(query: TaskQueryParams): string {
  const pairs: Array<[string, string]> = [];
  if (query.status) pairs.push(['status', String(query.status)]);
  if (query.creator) pairs.push(['creator', String(query.creator)]);
  if (query.agent) pairs.push(['agent', String(query.agent)]);
  if (query.q) pairs.push(['q', String(query.q)]);
  pairs.push(['limit', String(query.limit ?? 50)]);
  pairs.push(['offset', String(query.offset ?? 0)]);
  pairs.sort(([a], [b]) => a.localeCompare(b));
  return `tasks:list:${pairs.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

router.get(
  '/',
  validateQuery(taskQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as TaskQueryParams;
    const cacheKey = buildTaskListCacheKey(query);

    const cached = await cacheGetJson<{ tasks: TaskRow[]; count: number }>(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=20');
      res.set('x-cache', 'HIT');
      res.json(cached);
      return;
    }

    const tasks = await listTasks(query);
    const payload = { tasks, count: tasks.length };
    await cacheSetJson(cacheKey, payload, 10);

    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=20');
    res.set('x-cache', 'MISS');
    res.json(payload);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cacheKey = `tasks:detail:${req.params.id}`;
    const cached = await cacheGetJson<TaskRow>(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.set('x-cache', 'HIT');
      res.json(cached);
      return;
    }

    const task = await findTaskById(req.params.id);
    if (!task) throw new AppError(404, 'Task not found');
    await cacheSetJson(cacheKey, task, 30);
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.set('x-cache', 'MISS');
    res.json(task);
  }),
);

export default router;
