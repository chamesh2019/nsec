import { serve } from '@hono/node-server';
import { createHonoServer } from './server.js';
import type { Hono } from 'hono';
import type { Server } from 'node:http';

export * from './server.js';
export * from './db/index.js';
export * from './middleware/index.js';
export * from './routes/index.js';
export * from './dashboard/dashboard.js';
export * from './dashboard/html.js';

export const SERVER_VERSION = '0.2.0';

export function serveServer(
  app: Hono,
  options: { port?: number; hostname?: string } = {}
): Promise<{ server: Server; port: number; url: string }> {
  const port = options.port ?? 0;
  const hostname = options.hostname ?? '127.0.0.1';

  return new Promise((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        port,
        hostname
      },
      (info) => {
        resolve({
          server: server as unknown as Server,
          port: info.port,
          url: `http://${hostname}:${info.port}`
        });
      }
    );
  });
}

import { SqliteDatabaseAdapter, MemoryDatabaseAdapter, type DatabaseAdapter } from './db/index.js';

export async function startServer(
  options: { port?: number; host?: string; db?: DatabaseAdapter } = {}
): Promise<Server> {
  const port = options.port || parseInt(process.env.PORT || '4000', 10);
  const host = options.host || process.env.HOST || '0.0.0.0';

  let db = options.db;
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || process.env.SQLITE_PATH;
    if (dbPath) {
      db = new SqliteDatabaseAdapter(dbPath);
    } else {
      db = new MemoryDatabaseAdapter();
    }
  }

  const app = createHonoServer({ db });
  const { server } = await serveServer(app, { port, hostname: host });
  console.log(`nullsec zero-knowledge server listening at http://${host}:${port}`);
  return server;
}


// If invoked directly from node/tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
