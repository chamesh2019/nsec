import type { FastifyPluginAsync } from 'fastify';
import { UploadSecretsInputSchema, type SecretsResponseDTO } from '@zvault/core';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders } from '../middleware/auth.js';

export const secretRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // PUT /api/v1/projects/:id/environments/:env/secrets - Upload encrypted secrets & project keys
  fastify.put('/api/v1/projects/:id/environments/:env/secrets', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const { id, env } = request.params as { id: string; env: string };
    const project = await db.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: 'NotFoundError', message: `Project ${id} not found` });
    }

    const parseResult = UploadSecretsInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'ValidationError', message: parseResult.error.message });
    }

    const { secretsPayload, projectKeys } = parseResult.data;
    const existing = await db.getSecrets(id, env);
    const version = existing ? existing.version + 1 : 1;

    await db.saveSecrets({
      projectId: id,
      environment: env,
      secretsPayload,
      projectKeys,
      version,
      updatedAt: new Date().toISOString()
    });

    return reply.status(200).send({ success: true, version });
  });

  // GET /api/v1/projects/:id/environments/:env/secrets - Fetch encrypted secrets & user's project key
  fastify.get('/api/v1/projects/:id/environments/:env/secrets', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, null, db);
    if (!auth.authenticated) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const { id, env } = request.params as { id: string; env: string };
    const secretsRecord = await db.getSecrets(id, env);
    if (!secretsRecord) {
      return reply.status(404).send({
        error: 'NotFoundError',
        message: `No secrets found for project ${id} in environment ${env}`
      });
    }

    // Identify requesting identity (user or service token)
    let encryptedKey: { encryptedKey: string; algorithm: 'RSA-OAEP-4096' } | undefined;

    if (auth.user) {
      encryptedKey = secretsRecord.projectKeys[auth.user.id];
    } else if (auth.serviceToken) {
      // Check service token environment match
      if (auth.serviceToken.projectId !== id || auth.serviceToken.environment !== env) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Service token not authorized for this environment' });
      }
      encryptedKey = secretsRecord.projectKeys[auth.serviceToken.id];
    }

    if (!encryptedKey) {
      // If no individual key mapping exists for this user, check if any default/admin key exists or reject
      return reply.status(403).send({
        error: 'Forbidden',
        message: `User does not have access to decrypt secrets for environment ${env}. An admin must share the project key.`
      });
    }

    const response: SecretsResponseDTO = {
      projectId: id,
      environment: env,
      secretsPayload: secretsRecord.secretsPayload,
      encryptedProjectKey: encryptedKey,
      version: secretsRecord.version,
      updatedAt: secretsRecord.updatedAt
    };

    return reply.status(200).send(response);
  });
};
