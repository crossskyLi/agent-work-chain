import { runLifecycle } from '../src/services/lifecycle.service';

type Task = {
  task_id: string;
  description: string;
  status: string;
};

type TaskListResponse = {
  tasks: Task[];
  count: number;
};

const INDEXER_BASE = process.env.INDEXER_BASE_URL || 'http://localhost:3001';
const TARGET_KEYWORD = (process.env.AGENT_TARGET_KEYWORD || 'optimize').toLowerCase();
const INTERVAL_MS = Number(process.env.AGENT_POLL_MS || 3000);
const MAX_LOOPS = Number(process.env.AGENT_MAX_LOOPS || 20);

const claimed = new Set<string>();

async function fetchCreatedTasks(): Promise<Task[]> {
  const url = new URL('/v1/tasks', INDEXER_BASE);
  url.searchParams.set('status', 'Created');
  url.searchParams.set('limit', '20');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch tasks: HTTP ${res.status}`);
  }
  const data = (await res.json()) as TaskListResponse;
  return data.tasks || [];
}

function processTask(task: Task) {
  if (claimed.has(task.task_id)) return;
  claimed.add(task.task_id);

  console.log(`[worker] picked task ${task.task_id}`);
  try {
    const result = runLifecycle(task.task_id);
    console.log(`[worker] lifecycle result for ${task.task_id}:`, {
      status: result.finalStatus,
      score: result.qualityScore,
      approved: result.approved,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] lifecycle failed for ${task.task_id}: ${msg}`);
    claimed.delete(task.task_id);
  }
}

function shouldHandle(task: Task) {
  const text = `${task.task_id} ${task.description}`.toLowerCase();
  return text.includes(TARGET_KEYWORD);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[worker] starting agent worker at ${INDEXER_BASE}`);
  console.log(`[worker] target keyword: "${TARGET_KEYWORD}", interval: ${INTERVAL_MS}ms`);

  for (let i = 0; i < MAX_LOOPS; i += 1) {
    try {
      const tasks = await fetchCreatedTasks();
      const candidates = tasks.filter(shouldHandle);
      if (candidates.length > 0) {
        for (const task of candidates) {
          processTask(task);
        }
        console.log('[worker] done: matched task(s) processed');
        return;
      }
      console.log(`[worker] no matching task yet (loop ${i + 1}/${MAX_LOOPS})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] poll error: ${message}`);
    }
    await sleep(INTERVAL_MS);
  }

  console.log('[worker] finished without matching task');
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
