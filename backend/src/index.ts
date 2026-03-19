import app from './app';
import { EventListener } from './listener';
import { closeDb } from './db';
import { ensurePgSchema, closePg } from './db/postgres';
import { closeRedis } from './cache/redis';
import { logger } from './middleware/logger';

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const TRUSTCHAIN_ADDRESS = process.env.TRUSTCHAIN_ADDRESS;

let listener: EventListener | null = null;

async function main() {
  await ensurePgSchema();

  if (TRUSTCHAIN_ADDRESS) {
    listener = new EventListener({
      rpcUrl: RPC_URL,
      trustChainAddress: TRUSTCHAIN_ADDRESS,
    });
    listener.start();
  } else {
    logger.warn(
      'TRUSTCHAIN_ADDRESS is not set. Running in docs-only mode (no chain indexing).',
    );
  }

  const server = app.listen(PORT, () => {
    logger.info(`Indexer running on port ${PORT}`);
    if (TRUSTCHAIN_ADDRESS) {
      logger.info(`Listening to TrustChain at ${TRUSTCHAIN_ADDRESS}`);
    }
  });

  async function shutdown() {
    logger.info('Shutting down...');
    listener?.stop();
    server.close(async () => {
      closeDb();
      await closePg();
      await closeRedis();
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
main().catch((err) => {
  logger.error({ err }, 'failed to start indexer');
  process.exit(1);
});

export default app;
