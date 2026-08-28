import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MemoryDatabaseAdapter } from './db/memory-adapter.js';
import type { DatabaseAdapter } from './db/types.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createSessionRoutes } from './routes/session.routes.js';
import { createInviteRoutes } from './routes/invites.routes.js';
import { createProjectRoutes } from './routes/projects.routes.js';
import { createSecretRoutes } from './routes/secrets.routes.js';
import { createTokenRoutes } from './routes/tokens.routes.js';
import { createDashboardRoutes } from './dashboard/dashboard.js';

export interface ServerOptions {
  db?: DatabaseAdapter;
}

export function createHonoServer(options: ServerOptions = {}): Hono {
  const db = options.db || new MemoryDatabaseAdapter();
  const app = new Hono();

  // Enable CORS
  app.use('*', cors());

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok', service: 'nullsec-server', version: '0.2.0' });
  });

  // Mount Dashboard & Routes
  app.route('/', createDashboardRoutes());
  app.route('/', createSessionRoutes(db));
  app.route('/', createAuthRoutes(db));
  app.route('/', createInviteRoutes(db));
  app.route('/', createProjectRoutes(db));
  app.route('/', createSecretRoutes(db));
  app.route('/', createTokenRoutes(db));

  return app;
}

export const createServer = createHonoServer;
