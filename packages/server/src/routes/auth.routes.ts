import { Hono } from 'hono';
import crypto from 'node:crypto';
import {
  RegisterUserInputSchema,
  RotateKeysInputSchema,
  UpdateUserRoleInputSchema,
  type UserDTO,
  type ServerUserRole
} from '@nsec/core';
import type { DatabaseAdapter } from '../db/types.js';
import { verifyAuthHeaders, hashToken } from '../middleware/auth.js';

export function createAuthRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // POST /api/v1/auth/register - Register a new user with public keys and optional invite/bootstrap token
  router.post('/api/v1/auth/register', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parseResult = RegisterUserInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({
        error: 'ValidationError',
        message: parseResult.error.message
      }, 400);
    }

    const { email, publicKeys, token } = parseResult.data;
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return c.json({
        error: 'ConflictError',
        message: `User with email "${email}" is already registered. To rotate keys, authenticate with your existing signing key and use /api/v1/auth/rotate-keys.`
      }, 409);
    }

    let role: ServerUserRole = 'member';
    const totalUsers = await db.countUsers();

    if (totalUsers === 0) {
      // First registered user automatically becomes server administrator
      role = 'admin';
    } else if (process.env.NSEC_BOOTSTRAP_TOKEN && token && token === process.env.NSEC_BOOTSTRAP_TOKEN) {
      // Bootstrap token grants admin role
      role = 'admin';
    } else {
      // Regular registration requires a valid invite token
      if (!token) {
        return c.json({
          error: 'AuthenticationError',
          message: 'Registration requires an invite token. Request an invite from a server administrator.'
        }, 401);
      }

      const tokenHash = hashToken(token);
      const invite = await db.getInviteTokenByHash(tokenHash);

      if (!invite) {
        return c.json({
          error: 'AuthenticationError',
          message: 'Invalid or revoked invite token.'
        }, 401);
      }

      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        await db.deleteInviteToken(invite.id);
        return c.json({
          error: 'AuthenticationError',
          message: 'Invite token has expired.'
        }, 401);
      }

      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return c.json({
          error: 'ValidationError',
          message: `Invite token was issued for "${invite.email}", but registration attempted with "${email}".`
        }, 400);
      }

      role = invite.role || 'member';
      // Single-use token: consume immediately upon registration
      await db.deleteInviteToken(invite.id);
    }

    const newUser: UserDTO = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email,
      role,
      publicKeys,
      createdAt: new Date().toISOString()
    };

    await db.saveUser(newUser);
    return c.json(newUser, 201);
  });

  // POST /api/v1/auth/rotate-keys - Authenticated key rotation using existing signing key
  router.post('/api/v1/auth/rotate-keys', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({
        error: 'AuthenticationError',
        message: auth.error || 'Authentication required to rotate keys'
      }, 401);
    }

    const parseResult = RotateKeysInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({
        error: 'ValidationError',
        message: parseResult.error.message
      }, 400);
    }

    auth.user.publicKeys = parseResult.data.publicKeys;
    await db.saveUser(auth.user);

    return c.json(auth.user, 200);
  });

  // GET /api/v1/users - List all registered users (admin only)
  router.get('/api/v1/users', async (c) => {
    const auth = await verifyAuthHeaders(c.req.header(), null, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (auth.user.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin role required to list server users' }, 403);
    }

    const users = await db.listUsers();
    return c.json(users, 200);
  });

  // PATCH /api/v1/users/:id/role - Update user server role (admin only)
  router.patch('/api/v1/users/:id/role', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const auth = await verifyAuthHeaders(c.req.header(), body, db);
    if (!auth.authenticated || !auth.user) {
      return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
    }

    if (auth.user.role !== 'admin') {
      return c.json({ error: 'Forbidden', message: 'Admin role required to update user roles' }, 403);
    }

    const id = c.req.param('id');
    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return c.json({ error: 'NotFoundError', message: `User ${id} not found` }, 404);
    }

    const parseResult = UpdateUserRoleInputSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
    }

    const { role } = parseResult.data;

    // Safety check: prevent last admin from demoting themselves
    if (targetUser.role === 'admin' && role !== 'admin') {
      const allUsers = await db.listUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        return c.json({
          error: 'ValidationError',
          message: 'Cannot demote the only server administrator.'
        }, 400);
      }
    }

    await db.updateUserRole(id, role);
    targetUser.role = role;
    return c.json(targetUser, 200);
  });

  // GET /api/v1/users/:idOrEmail - Lookup public keys for key sharing
  router.get('/api/v1/users/:idOrEmail', async (c) => {
    const idOrEmail = c.req.param('idOrEmail');
    const user = (await db.getUserById(idOrEmail)) || (await db.getUserByEmail(idOrEmail));

    if (!user) {
      return c.json({ error: 'NotFoundError', message: 'User not found' }, 404);
    }

    return c.json(user, 200);
  });

  return router;
}

export const authRoutes = createAuthRoutes;
