import { Hono } from 'hono';
import crypto from 'node:crypto';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders, hashToken } from '../middleware/auth.js';
import type { ServiceTokenDTO } from '@nsec/core';

export function createTokenRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // POST /api/v1/projects/:id/tokens - Create CI/CD Service Token
  router.post('/api/v1/projects/:id/tokens', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const project = await db.getProject(id);
    if (!project) {
      return c.json({ error: 'NotFoundError', message: `Project ${id} not found` }, 404);
    }

    if (!body.environment || !body.name) {
      return c.json({ error: 'ValidationError', message: 'Environment and name are required' }, 400);
    }

    const tokenId = `tok_${crypto.randomBytes(8).toString('hex')}`;
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const fullToken = `zv_st_${tokenId}_${rawSecret}`;
    const tokenHash = hashToken(fullToken);

    await db.saveServiceToken({
      id: tokenId,
      projectId: id,
      environment: body.environment,
      name: body.name,
      tokenHash,
      expiresAt: body.expiresAt,
      createdAt: new Date().toISOString()
    });

    const response: ServiceTokenDTO = {
      id: tokenId,
      projectId: id,
      environment: body.environment,
      name: body.name,
      token: fullToken,
      expiresAt: body.expiresAt,
      createdAt: new Date().toISOString()
    };

    return c.json(response, 201);
  });

  return router;
}

export const tokenRoutes = createTokenRoutes;
