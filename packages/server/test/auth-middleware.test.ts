import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateUserKeyPair, signPayload } from '@nsec/crypto';
import { MemoryDatabaseAdapter } from '../src/db/index.js';
import { verifyAuthHeaders } from '../src/middleware/auth.js';

describe('Auth Middleware', () => {
  it('authenticates valid Ed25519 signed request', async () => {
    const db = new MemoryDatabaseAdapter();
    const userKeys = await generateUserKeyPair();
    const user = {
      id: 'usr_abc',
      email: 'alice@example.com',
      publicKeys: { signingKey: userKeys.signing.publicKey, encryptionKey: userKeys.encryption.publicKey },
      createdAt: new Date().toISOString()
    };
    await db.saveUser(user);

    const body = { action: 'fetch_secrets' };
    const signed = signPayload(body, userKeys.signing.privateKey, userKeys.signing.publicKey);

    const headers = {
      'x-zvault-signature': signed.signature,
      'x-zvault-public-key': Buffer.from(signed.publicKey).toString('base64'),
      'x-zvault-timestamp': String(signed.timestamp)
    };

    const authResult = await verifyAuthHeaders(headers, body, db);
    assert.equal(authResult.authenticated, true);
    assert.equal(authResult.user?.id, 'usr_abc');
  });

  it('rejects expired timestamp replay attack', async () => {
    const db = new MemoryDatabaseAdapter();
    const userKeys = await generateUserKeyPair();

    const oldTimestamp = Date.now() - 120_000; // 2 minutes ago
    const headers = {
      'x-zvault-signature': 'sig',
      'x-zvault-public-key': Buffer.from(userKeys.signing.publicKey).toString('base64'),
      'x-zvault-timestamp': String(oldTimestamp)
    };

    const authResult = await verifyAuthHeaders(headers, {}, db);
    assert.equal(authResult.authenticated, false);
    assert.match(authResult.error || '', /Timestamp expired/);
  });
});
