import type { FastifyPluginAsync } from 'fastify';
import { verifySignatureAsync, type SignedMessage } from '@nsec/crypto';
import type { DatabaseAdapter } from '../db/types.js';
import { globalSessionStore, extractSessionToken } from '../middleware/session.js';

export interface DashboardTicketPayload {
  action: 'dashboard_login';
  email: string;
  serverUrl?: string;
  nonce: string;
}

export const sessionRoutes: FastifyPluginAsync<{ db: DatabaseAdapter }> = async (fastify, opts) => {
  const { db } = opts;

  // POST /api/v1/auth/session - Exchange cryptographic login ticket for session
  fastify.post('/api/v1/auth/session', async (request, reply) => {
    const body = request.body as { ticket?: string } | undefined;
    if (!body || typeof body.ticket !== 'string') {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Missing or invalid "ticket" string in request body'
      });
    }

    let signedMessage: SignedMessage<DashboardTicketPayload>;
    try {
      const decodedJson = Buffer.from(body.ticket, 'base64url').toString('utf-8');
      signedMessage = JSON.parse(decodedJson);
    } catch {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Malformed base64url ticket payload'
      });
    }

    const { payload, signature, publicKey, timestamp } = signedMessage;

    if (!payload || payload.action !== 'dashboard_login' || !payload.email || !payload.nonce) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid ticket structure (must contain action="dashboard_login", email, nonce)'
      });
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > 60_000) {
      return reply.status(401).send({
        error: 'AuthenticationError',
        message: 'Login ticket has expired (must be used within 60 seconds of generation)'
      });
    }

    if (globalSessionStore.isNonceUsed(payload.nonce)) {
      return reply.status(401).send({
        error: 'AuthenticationError',
        message: 'Login ticket has already been used (replay detected)'
      });
    }

    const isValidSig = await verifySignatureAsync(signedMessage);
    if (!isValidSig) {
      return reply.status(401).send({
        error: 'AuthenticationError',
        message: 'Invalid cryptographic signature in login ticket'
      });
    }

    // Lookup user by signing key
    const user = await db.getUserBySigningKey(publicKey);
    if (!user) {
      return reply.status(401).send({
        error: 'AuthenticationError',
        message: 'Public key in ticket is not registered with any server account'
      });
    }

    if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: `Ticket email (${payload.email}) does not match registered email (${user.email})`
      });
    }

    if (user.role !== 'admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Administrator role required to access server web dashboard'
      });
    }

    globalSessionStore.markNonceUsed(payload.nonce);
    const session = globalSessionStore.createSession(user);

    reply.header(
      'Set-Cookie',
      `nsec_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
    );

    return reply.status(200).send({
      token: session.token,
      user: session.user,
      expiresAt: session.expiresAt
    });
  });

  // GET /api/v1/auth/session/me - Check active session and fetch dashboard overview stats
  fastify.get('/api/v1/auth/session/me', async (request, reply) => {
    const token = extractSessionToken(request.headers);
    if (!token) {
      return reply.status(401).send({ error: 'AuthenticationError', message: 'No active session' });
    }

    const session = globalSessionStore.getSession(token);
    if (!session) {
      return reply.status(401).send({ error: 'AuthenticationError', message: 'Session expired or invalid' });
    }

    const allUsers = await db.listUsers();
    const invites = await db.listInviteTokens();
    const projects = await db.getProjectsForUser(session.user.id);

    return reply.status(200).send({
      user: session.user,
      stats: {
        totalUsers: allUsers.length,
        adminUsers: allUsers.filter((u) => u.role === 'admin').length,
        pendingInvites: invites.length,
        totalProjects: projects.length
      },
      version: '0.2.0'
    });
  });

  // DELETE /api/v1/auth/session - Logout
  fastify.delete('/api/v1/auth/session', async (request, reply) => {
    const token = extractSessionToken(request.headers);
    if (token) {
      globalSessionStore.deleteSession(token);
    }

    reply.header(
      'Set-Cookie',
      'nsec_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    );

    return reply.status(200).send({ success: true });
  });
};
