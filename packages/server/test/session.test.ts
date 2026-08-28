import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateUserKeyPair, signPayload } from '@nsec/crypto';
import { createServer } from '../src/server.js';
import { MemoryDatabaseAdapter } from '../src/db/index.js';

describe('Web Admin Dashboard Session & Cryptographic Handoff', () => {
  let app: any;
  let serverUrl: string;
  let adminKeys: any;
  let memberKeys: any;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    app = await createServer({ db });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;

    // 1. Register first user (Admin)
    adminKeys = await generateUserKeyPair();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'admin@company.com',
        publicKeys: {
          signingKey: adminKeys.signing.publicKey,
          encryptionKey: adminKeys.encryption.publicKey
        }
      }
    });

    // 2. Create invite and register second user (Member)
    const invRes = await app.inject({
      method: 'POST',
      url: '/api/v1/invites',
      headers: {
        // We can use signature headers
      },
      payload: { email: 'dev@company.com', role: 'member' }
    });
    // Direct DB creation for member for setup speed
    memberKeys = await generateUserKeyPair();
    await db.saveUser({
      id: 'usr_dev_1',
      email: 'dev@company.com',
      role: 'member',
      publicKeys: {
        signingKey: memberKeys.signing.publicKey,
        encryptionKey: memberKeys.encryption.publicKey
      },
      createdAt: new Date().toISOString()
    });
  });

  after(async () => {
    await app.close();
  });

  it('serves dashboard HTML on GET /dashboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dashboard'
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/);
    assert.match(res.body, /NullSec Admin Dashboard/);
  });

  it('exchanges valid admin signed ticket for session cookie', async () => {
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = {
      action: 'dashboard_login' as const,
      email: 'admin@company.com',
      serverUrl,
      nonce
    };

    const signed = signPayload(payload, adminKeys.signing.privateKey, adminKeys.signing.publicKey);
    const ticket = Buffer.from(JSON.stringify(signed), 'utf-8').toString('base64url');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      payload: { ticket }
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.user.email, 'admin@company.com');
    assert.equal(data.user.role, 'admin');
    assert.ok(data.token.startsWith('ns_sess_'));
    assert.match(res.headers['set-cookie'] || '', /nsec_session=ns_sess_/);

    // Test GET /api/v1/auth/session/me with session cookie
    const cookie = res.headers['set-cookie'];
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session/me',
      headers: { cookie }
    });

    assert.equal(meRes.statusCode, 200);
    const meData = JSON.parse(meRes.body);
    assert.equal(meData.user.email, 'admin@company.com');
    assert.equal(meData.stats.totalUsers >= 2, true);

    // Replay attack with same nonce should be rejected
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      payload: { ticket }
    });
    assert.equal(replayRes.statusCode, 401);
    assert.match(replayRes.body, /replay detected/i);
  });

  it('rejects login ticket for non-admin member user', async () => {
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = {
      action: 'dashboard_login' as const,
      email: 'dev@company.com',
      serverUrl,
      nonce
    };

    const signed = signPayload(payload, memberKeys.signing.privateKey, memberKeys.signing.publicKey);
    const ticket = Buffer.from(JSON.stringify(signed), 'utf-8').toString('base64url');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      payload: { ticket }
    });

    assert.equal(res.statusCode, 403);
    assert.match(res.body, /Administrator role required/i);
  });
});
