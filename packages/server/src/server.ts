import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { MemoryDatabaseAdapter } from './db/memory-adapter.js';
import type { DatabaseAdapter } from './db/types.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/projects.routes.js';
import { secretRoutes } from './routes/secrets.routes.js';
import { tokenRoutes } from './routes/tokens.routes.js';

export interface ServerOptions {
  db?: DatabaseAdapter;
  logger?: boolean;
}

export async function createServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const db = options.db || new MemoryDatabaseAdapter();
  const fastify = Fastify({
    logger: options.logger ?? false
  });

  await fastify.register(cors, {
    origin: true
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'zvault-server', version: '0.1.0' };
  });

  // Register API routes
  await fastify.register(authRoutes, { db });
  await fastify.register(projectRoutes, { db });
  await fastify.register(secretRoutes, { db });
  await fastify.register(tokenRoutes, { db });

  return fastify;
}
