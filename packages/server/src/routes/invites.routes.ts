import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { CreateInviteInputSchema, type InviteTokenDTO } from '@nsec/core';
import type { DatabaseAdapter, StoredInviteTokenRecord } from '../db/types.js';
import { verifyAuthHeaders, hashToken } from '../middleware/auth.js';

export const inviteRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/invites - Create invite token (admin only)
  fastify.post('/api/v1/invites', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    if (auth.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin role required to generate invite tokens' });
    }

    const parseResult = CreateInviteInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'ValidationError', message: parseResult.error.message });
    }

    const { email, role, expiresAt } = parseResult.data;

    // Check if user is already registered
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({
        error: 'ConflictError',
        message: `User with email "${email}" is already registered.`
      });
    }

    const tokenId = `inv_${crypto.randomBytes(8).toString('hex')}`;
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const fullToken = `ns_inv_${tokenId}_${rawSecret}`;
    const tokenHash = hashToken(fullToken);


    const record: StoredInviteTokenRecord = {
      id: tokenId,
      email,
      tokenHash,
      role: role || 'member',
      invitedBy: auth.user.email,
      expiresAt,
      createdAt: new Date().toISOString()
    };

    await db.saveInviteToken(record);

    const response: InviteTokenDTO = {
      id: tokenId,
      email,
      role: record.role,
      token: fullToken,
      invitedBy: record.invitedBy,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt
    };

    return reply.status(201).send(response);
  });

  // GET /api/v1/invites - List pending invite tokens (admin only)
  fastify.get('/api/v1/invites', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, null, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    if (auth.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin role required to view invite tokens' });
    }

    const invites = await db.listInviteTokens();
    const safeInvites: InviteTokenDTO[] = invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt
    }));

    return reply.status(200).send(safeInvites);
  });

  // DELETE /api/v1/invites/:id - Revoke invite token (admin only)
  fastify.delete('/api/v1/invites/:id', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, null, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    if (auth.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin role required to revoke invite tokens' });
    }

    const { id } = request.params as { id: string };
    const success = await db.deleteInviteToken(id);

    return reply.status(200).send({ success });
  });
};
