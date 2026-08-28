import { Hono } from 'hono';
import { verifySignatureAsync, type SignedMessage } from '@nsec/crypto';
import type { DatabaseAdapter } from '../db/types.js';
import { globalSessionStore, extractSessionToken } from '../middleware/session.js';

export interface DashboardTicketPayload {
  action: 'dashboard_login';
  email: string;
  serverUrl?: string;
  nonce: string;
}

export function createSessionRoutes(db: DatabaseAdapter): Hono {
  const router = new Hono();

  // POST /api/v1/auth/session - Exchange cryptographic login ticket for session
  router.post('/api/v1/auth/session', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body || typeof body.ticket !== 'string') {
      return c.json({
        error: 'ValidationError',
        message: 'Missing or invalid "ticket" string in request body'
      }, 400);
    }

    let signedMessage: SignedMessage<DashboardTicketPayload>;
    try {
      const decodedJson = Buffer.from(body.ticket, 'base64url').toString('utf-8');
      signedMessage = JSON.parse(decodedJson);
    } catch {
      return c.json({
        error: 'ValidationError',
        message: 'Malformed base64url ticket payload'
      }, 400);
    }

    const { payload, signature, publicKey, timestamp } = signedMessage;

    if (!payload || payload.action !== 'dashboard_login' || !payload.email || !payload.nonce) {
      return c.json({
        error: 'ValidationError',
        message: 'Invalid ticket structure (must contain action="dashboard_login", email, nonce)'
      }, 400);
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > 60_000) {
      return c.json({
        error: 'AuthenticationError',
        message: 'Login ticket has expired (must be used within 60 seconds of generation)'
      }, 401);
    }

    if (globalSessionStore.isNonceUsed(payload.nonce)) {
      return c.json({
        error: 'AuthenticationError',
        message: 'Login ticket has already been used (replay detected)'
      }, 401);
    }

    const isValidSig = await verifySignatureAsync(signedMessage);
    if (!isValidSig) {
      return c.json({
        error: 'AuthenticationError',
        message: 'Invalid cryptographic signature in login ticket'
      }, 401);
    }

    // Lookup user by signing key
    const user = await db.getUserBySigningKey(publicKey);
    if (!user) {
      return c.json({
        error: 'AuthenticationError',
        message: 'Public key in ticket is not registered with any server account'
      }, 401);
    }

    if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
      return c.json({
        error: 'ValidationError',
        message: `Ticket email (${payload.email}) does not match registered email (${user.email})`
      }, 400);
    }

    if (user.role !== 'admin') {
      return c.json({
        error: 'Forbidden',
        message: 'Administrator role required to access server web dashboard'
      }, 403);
    }

    globalSessionStore.markNonceUsed(payload.nonce);
    const session = globalSessionStore.createSession(user);

    c.header(
      'Set-Cookie',
      `nsec_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
    );

    return c.json({
      token: session.token,
      user: session.user,
      expiresAt: session.expiresAt
    }, 200);
  });

  // GET /api/v1/auth/session/me - Check active session and fetch dashboard overview stats
  router.get('/api/v1/auth/session/me', async (c) => {
    const token = extractSessionToken(c.req.header());
    if (!token) {
      return c.json({ error: 'AuthenticationError', message: 'No active session' }, 401);
    }

    const session = globalSessionStore.getSession(token);
    if (!session) {
      return c.json({ error: 'AuthenticationError', message: 'Session expired or invalid' }, 401);
    }

    const allUsers = await db.listUsers();
    const invites = await db.listInviteTokens();
    const projects = await db.getProjectsForUser(session.user.id);

    return c.json({
      user: session.user,
      stats: {
        totalUsers: allUsers.length,
        adminUsers: allUsers.filter((u) => u.role === 'admin').length,
        pendingInvites: invites.length,
        totalProjects: projects.length
      },
      version: '0.2.0'
    }, 200);
  });

  // DELETE /api/v1/auth/session - Logout
  router.delete('/api/v1/auth/session', async (c) => {
    const token = extractSessionToken(c.req.header());
    if (token) {
      globalSessionStore.deleteSession(token);
    }

    c.header(
      'Set-Cookie',
      'nsec_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    );

    return c.json({ success: true }, 200);
  });

  return router;
}

export const sessionRoutes = createSessionRoutes;
