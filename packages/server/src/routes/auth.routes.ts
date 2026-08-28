import type { FastifyPluginAsync } from 'fastify';
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

export const authRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/auth/register - Register a new user with public keys and optional invite/bootstrap token
  fastify.post('/api/v1/auth/register', async (request, reply) => {
    const parseResult = RegisterUserInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parseResult.error.message
      });
    }

    const { email, publicKeys, token } = parseResult.data;
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({
        error: 'ConflictError',
        message: `User with email "${email}" is already registered. To rotate keys, authenticate with your existing signing key and use /api/v1/auth/rotate-keys.`
      });
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
        return reply.status(401).send({
          error: 'AuthenticationError',
          message: 'Registration requires an invite token. Request an invite from a server administrator.'
        });
      }

      const tokenHash = hashToken(token);
      const invite = await db.getInviteTokenByHash(tokenHash);

      if (!invite) {
        return reply.status(401).send({
          error: 'AuthenticationError',
          message: 'Invalid or revoked invite token.'
        });
      }

      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        await db.deleteInviteToken(invite.id);
        return reply.status(401).send({
          error: 'AuthenticationError',
          message: 'Invite token has expired.'
        });
      }

      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: `Invite token was issued for "${invite.email}", but registration attempted with "${email}".`
        });
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
    return reply.status(201).send(newUser);
  });

  // POST /api/v1/auth/rotate-keys - Authenticated key rotation using existing signing key
  fastify.post('/api/v1/auth/rotate-keys', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({
        error: 'AuthenticationError',
        message: auth.error || 'Authentication required to rotate keys'
      });
    }

    const parseResult = RotateKeysInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parseResult.error.message
      });
    }

    auth.user.publicKeys = parseResult.data.publicKeys;
    await db.saveUser(auth.user);

    return reply.status(200).send(auth.user);
  });

  // GET /api/v1/users - List all registered users (admin only)
  fastify.get('/api/v1/users', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, null, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    if (auth.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin role required to list server users' });
    }

    const users = await db.listUsers();
    return reply.status(200).send(users);
  });

  // PATCH /api/v1/users/:id/role - Update user server role (admin only)
  fastify.patch('/api/v1/users/:id/role', async (request, reply) => {
    const auth = await verifyAuthHeaders(request.headers, request.body, db);
    if (!auth.authenticated || !auth.user) {
      return reply.status(401).send({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' });
    }

    if (auth.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin role required to update user roles' });
    }

    const { id } = request.params as { id: string };
    const targetUser = await db.getUserById(id);
    if (!targetUser) {
      return reply.status(404).send({ error: 'NotFoundError', message: `User ${id} not found` });
    }

    const parseResult = UpdateUserRoleInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'ValidationError', message: parseResult.error.message });
    }

    const { role } = parseResult.data;

    // Safety check: prevent last admin from demoting themselves
    if (targetUser.role === 'admin' && role !== 'admin') {
      const allUsers = await db.listUsers();
      const adminCount = allUsers.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Cannot demote the only server administrator.'
        });
      }
    }

    await db.updateUserRole(id, role);
    targetUser.role = role;
    return reply.status(200).send(targetUser);
  });

  // GET /api/v1/users/:idOrEmail - Lookup public keys for key sharing
  fastify.get('/api/v1/users/:idOrEmail', async (request, reply) => {
    const { idOrEmail } = request.params as { idOrEmail: string };
    const user = (await db.getUserById(idOrEmail)) || (await db.getUserByEmail(idOrEmail));

    if (!user) {
      return reply.status(404).send({ error: 'NotFoundError', message: 'User not found' });
    }

    return reply.status(200).send(user);
  });
};

