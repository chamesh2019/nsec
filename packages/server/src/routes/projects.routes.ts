import { Hono } from 'hono';
import crypto from 'node:crypto';
import { AddMemberInputSchema, type ProjectDTO } from '@nsec/core';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders } from '../middleware/auth.js';

export function createProjectRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // POST /api/v1/projects - Create project
  router.post('/api/v1/projects', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (!body.name) {
      return c.json({ error: 'ValidationError', message: 'Project name is required' }, 400);
    }

    const projectId = `proj_${crypto.randomBytes(8).toString('hex')}`;
    const environments = body.environments || ['development', 'staging', 'production'];

    const newProject: ProjectDTO = {
      id: projectId,
      name: body.name,
      environments,
      members: [
        {
          userId: auth.user.id,
          email: auth.user.email,
          role: 'admin',
          environments,
          joinedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.saveProject(newProject);
    return c.json(newProject, 201);
  });

  // GET /api/v1/projects/:id - Get project details
  router.get('/api/v1/projects/:id', async (c) => {
    const auth = await verifyAuthHeaders(c.req.header(), null, db);
    if (!auth.authenticated) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const project = await db.getProject(id);
    if (!project) {
      return c.json({ error: 'NotFoundError', message: `Project ${id} not found` }, 404);
    }

    return c.json(project, 200);
  });

  // POST /api/v1/projects/:id/members - Add/share project key with member
  router.post('/api/v1/projects/:id/members', async (c) => {
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

    const parseResult = AddMemberInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
    }

    const { email, role, environments, environmentKeys } = parseResult.data;
    const targetUser = await db.getUserByEmail(email);
    if (!targetUser) {
      return c.json({ error: 'NotFoundError', message: `User with email ${email} not registered` }, 404);
    }

    // Add member record
    await db.addProjectMember(id, {
      userId: targetUser.id,
      email: targetUser.email,
      role,
      environments,
      joinedAt: new Date().toISOString()
    });

    // Store encrypted project keys per environment for this member
    for (const [env, encKey] of Object.entries(environmentKeys)) {
      const secretsRec = await db.getSecrets(id, env);
      if (secretsRec) {
        secretsRec.projectKeys[targetUser.id] = encKey;
        await db.saveSecrets(secretsRec);
      }
    }

    const updated = await db.getProject(id);
    return c.json(updated, 200);
  });

  return router;
}

export const projectRoutes = createProjectRoutes;
