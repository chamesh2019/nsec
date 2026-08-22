import { createServer } from './server.js';
import { MemoryDatabaseAdapter } from './db/memory-adapter.js';

export * from './server.js';
export * from './db/index.js';
export * from './middleware/index.js';
export * from './routes/index.js';

export const SERVER_VERSION = '0.1.0';

export async function startServer(options: { port?: number; host?: string } = {}) {
  const port = options.port || parseInt(process.env.PORT || '4000', 10);
  const host = options.host || process.env.HOST || '0.0.0.0';

  const app = await createServer({ logger: true });
  await app.listen({ port, host });
  console.log(`zvault zero-knowledge server listening at http://${host}:${port}`);
  return app;
}

// If invoked directly from node/tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
