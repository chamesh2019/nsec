import { Hono } from 'hono';
import crypto from 'node:crypto';
import { CreateInviteInputSchema, type InviteTokenDTO } from '@nsec/core';
import type { DatabaseAdapter, StoredInviteTokenRecord } from '../db/types.js';
import { verifyAuthHeaders, hashToken } from '../middleware/auth.js';

export function createInviteRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // POST /api/v1/invites - Create invite token (admin only)
  router.post('/api/v1/invites', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (auth.user.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin role required to generate invite tokens' }, 403);
    }

    const parseResult = CreateInviteInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
    }

    const { email, role, expiresAt } = parseResult.data;

    // Check if user is already registered
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return c.json({
        error: 'ConflictError',
        message: `User with email "${email}" is already registered.`
      }, 409);
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

    return c.json(response, 201);
  });

  // GET /api/v1/invites - List pending invite tokens (admin only)
  router.get('/api/v1/invites', async (c) => {
    const auth = await verifyAuthHeaders(c.req.header(), null, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (auth.user.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin role required to view invite tokens' }, 403);
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

    return c.json(safeInvites, 200);
  });

  // DELETE /api/v1/invites/:id - Revoke invite token (admin only)
  router.delete('/api/v1/invites/:id', async (c) => {
    const auth = await verifyAuthHeaders(c.req.header(), null, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (auth.user.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin role required to revoke invite tokens' }, 403);
    }

    const id = c.req.param('id');
    const success = await db.deleteInviteToken(id);

    return c.json({ success }, 200);
  });

  return router;
}

export const inviteRoutes = createInviteRoutes;
