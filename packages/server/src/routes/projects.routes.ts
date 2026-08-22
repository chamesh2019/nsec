import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { AddMemberInputSchema, type ProjectDTO } from '@chamesh2020/core';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders } from '../middleware/auth.js';

export const projectRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/projects - Create project
  fastify.post('/api/v1/projects', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const body = (request.body as { name?: string; environments?: string[] }) || {};
    if (!body.name) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Project name is required' });
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
    return reply.status(201).send(newProject);
  });

  // GET /api/v1/projects/:id - Get project details
  fastify.get('/api/v1/projects/:id', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, null, db);
    if (!auth.authenticated) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const project = await db.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: 'NotFoundError', message: `Project ${id} not found` });
    }

    return reply.status(200).send(project);
  });

  // POST /api/v1/projects/:id/members - Add/share project key with member
  fastify.post('/api/v1/projects/:id/members', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const project = await db.getProject(id);
    if (!project) {
      return reply.status(404).send({ error: 'NotFoundError', message: `Project ${id} not found` });
    }

    const parseResult = AddMemberInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'ValidationError', message: parseResult.error.message });
    }

    const { email, role, environments, environmentKeys } = parseResult.data;
    const targetUser = await db.getUserByEmail(email);
    if (!targetUser) {
      return reply.status(404).send({ error: 'NotFoundError', message: `User with email ${email} not registered` });
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
    return reply.status(200).send(updated);
  });
};
