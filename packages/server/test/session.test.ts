import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateUserKeyPair, signPayload } from '@nsec/crypto';
import { createHonoServer } from '../src/server.js';
import { MemoryDatabaseAdapter } from '../src/db/index.js';

describe('Web Admin Dashboard Session & Cryptographic Handoff', () => {
  let app: any;
  let serverUrl: string;
  let adminKeys: any;
  let memberKeys: any;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    app = createHonoServer({ db });
    serverUrl = 'http://127.0.0.1:4000';

    // 1. Register first user (Admin)
    adminKeys = await generateUserKeyPair();
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@company.com',
        publicKeys: {
          signingKey: adminKeys.signing.publicKey,
          encryptionKey: adminKeys.encryption.publicKey
        }
      })
    });

    // 2. Direct DB creation for member for setup speed
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

  it('serves dashboard HTML on GET /dashboard', async () => {
    const res = await app.request('/dashboard');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const body = await res.text();
    assert.match(body, /NullSec Admin Dashboard/);
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

    const res = await app.request('/api/v1/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, 'admin@company.com');
    assert.equal(data.user.role, 'admin');
    assert.ok(data.token.startsWith('ns_sess_'));
    assert.match(res.headers.get('set-cookie') || '', /nsec_session=ns_sess_/);

    // Test GET /api/v1/auth/session/me with session cookie
    const cookie = res.headers.get('set-cookie') || '';
    const meRes = await app.request('/api/v1/auth/session/me', {
      method: 'GET',
      headers: { cookie }
    });

    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, 'admin@company.com');
    assert.equal(meData.stats.totalUsers >= 2, true);

    // Replay attack with same nonce should be rejected
    const replayRes = await app.request('/api/v1/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    assert.equal(replayRes.status, 401);
    const replayBody = await replayRes.text();
    assert.match(replayBody, /replay detected/i);
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

    const res = await app.request('/api/v1/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });

    assert.equal(res.status, 403);
    const body = await res.text();
    assert.match(body, /Administrator role required/i);
  });
});
