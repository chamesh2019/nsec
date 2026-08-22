import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders, hashToken } from '../middleware/auth.js';
import type { ServiceTokenDTO } from '@zvault/core';

export const tokenRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/projects/:id/tokens - Create CI/CD Service Token
  fastify.post('/api/v1/projects/:id/tokens', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const project = await db.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: 'NotFoundError', message: `Project ${id} not found` });
    }

    const body = (request.body as { environment?: string; name?: string; expiresAt?: string }) || {};
    if (!body.environment || !body.name) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Environment and name are required' });
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

    return reply.status(201).send(response);
  });
};
