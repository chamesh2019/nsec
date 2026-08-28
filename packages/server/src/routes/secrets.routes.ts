import { Hono } from 'hono';
import { UploadSecretsInputSchema, type SecretsResponseDTO } from '@nsec/core';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders } from '../middleware/auth.js';

export function createSecretRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // PUT /api/v1/projects/:id/environments/:env/secrets - Upload encrypted secrets & project keys
  router.put('/api/v1/projects/:id/environments/:env/secrets', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const env = c.req.param('env');
    const project = await db.getProject(id);
    if (!project) {
      return c.json({ error: 'NotFoundError', message: `Project ${id} not found` }, 404);
    }

    const parseResult = UploadSecretsInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
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

    return c.json({ success: true, version }, 200);
  });

  // GET /api/v1/projects/:id/environments/:env/secrets - Fetch encrypted secrets & user's project key
  router.get('/api/v1/projects/:id/environments/:env/secrets', async (c) => {
    const auth = await verifyAuthHeaders(c.req.header(), null, db);
    if (!auth.authenticated) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const env = c.req.param('env');
    const secretsRecord = await db.getSecrets(id, env);
    if (!secretsRecord) {
      return c.json({
        error: 'NotFoundError',
        message: `No secrets found for project ${id} in environment ${env}`
      }, 404);
    }

    // Identify requesting identity (user or service token)
    let encryptedKey: { encryptedKey: string; algorithm: 'RSA-OAEP-4096' } | undefined;

    if (auth.user) {
      encryptedKey = secretsRecord.projectKeys[auth.user.id];
    } else if (auth.serviceToken) {
      // Check service token environment match
      if (auth.serviceToken.projectId !== id || auth.serviceToken.environment !== env) {
        return c.json({ error: 'Forbidden', message: 'Service token not authorized for this environment' }, 403);
      }
      encryptedKey = secretsRecord.projectKeys[auth.serviceToken.id];
    }

    if (!encryptedKey) {
      return c.json({
        error: 'Forbidden',
        message: `User does not have access to decrypt secrets for environment ${env}. An admin must share the project key.`
      }, 403);
    }

    const response: SecretsResponseDTO = {
      projectId: id,
      environment: env,
      secretsPayload: secretsRecord.secretsPayload,
      encryptedProjectKey: encryptedKey,
      version: secretsRecord.version,
      updatedAt: secretsRecord.updatedAt
    };

    return c.json(response, 200);
  });

  return router;
}

export const secretRoutes = createSecretRoutes;
