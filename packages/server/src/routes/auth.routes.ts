import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { RegisterUserInputSchema, type UserDTO } from '@nsec/core';
import type { DatabaseAdapter } from '../db/types.js';

export const authRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/auth/register - Register a new user with public keys
  fastify.post('/api/v1/auth/register', async (request, reply) => {
    const parseResult = RegisterUserInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parseResult.error.message
      });
    }

    const { email, publicKeys } = parseResult.data;
    const existing = await db.getUserByEmail(email);
    if (existing) {
      // Update public keys if user already exists
      existing.publicKeys = publicKeys;
      await db.saveUser(existing);
      return reply.status(200).send(existing);
    }

    const newUser: UserDTO = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email,
      publicKeys,
      createdAt: new Date().toISOString()
    };

    await db.saveUser(newUser);
    return reply.status(201).send(newUser);
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
