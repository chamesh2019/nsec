import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabaseAdapter } from '../src/db/memory-adapter.js';

describe('MemoryDatabaseAdapter', () => {
  let db: MemoryDatabaseAdapter;

  beforeEach(() => {
    db = new MemoryDatabaseAdapter();
  });

  it('saves and retrieves user by id and email', async () => {
    const user = {
      id: 'usr_123',
      email: 'dev@example.com',
      role: 'member' as const,
      publicKeys: {
        signingKey: 'ed25519_pk_pem',
        encryptionKey: 'rsa_pk_pem'
      },
      createdAt: new Date().toISOString()
    };

    await db.saveUser(user);
    assert.deepEqual(await db.getUserById('usr_123'), user);
    assert.deepEqual(await db.getUserByEmail('dev@example.com'), user);
    assert.deepEqual(await db.getUserBySigningKey('ed25519_pk_pem'), user);
    assert.equal(await db.countUsers(), 1);

    await db.updateUserRole('usr_123', 'admin');
    const updated = await db.getUserById('usr_123');
    assert.equal(updated?.role, 'admin');
  });

  it('manages invite tokens', async () => {
    const invite = {
      id: 'inv_123',
      email: 'invitee@example.com',
      tokenHash: 'hashed_token_abc',
      role: 'member' as const,
      invitedBy: 'admin@example.com',
      createdAt: new Date().toISOString()
    };

    await db.saveInviteToken(invite);
    const retrieved = await db.getInviteTokenByHash('hashed_token_abc');
    assert.deepEqual(retrieved, invite);

    const list = await db.listInviteTokens();
    assert.equal(list.length, 1);

    const deleted = await db.deleteInviteToken('inv_123');
    assert.equal(deleted, true);
    assert.equal(await db.getInviteTokenByHash('hashed_token_abc'), null);
  });

  it('manages projects and environment secrets', async () => {
    const project = {
      id: 'proj_123',
      name: 'ecommerce-backend',
      environments: ['development', 'production'],
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.saveProject(project);
    assert.deepEqual(await db.getProject('proj_123'), project);

    const secretRecord = {
      projectId: 'proj_123',
      environment: 'production',
      secretsPayload: {
        ciphertext: 'YWVzX2NpcGhlcg==',
        iv: 'MTIzNDU2Nzg5MDEy',
        tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
        version: 1
      },
      projectKeys: {
        usr_123: { encryptedKey: 'ZW5jcnlwdGVkX2tleQ==', algorithm: 'RSA-OAEP-4096' as const }
      },
      version: 1,
      updatedAt: new Date().toISOString()
    };
    await db.saveSecrets(secretRecord);

    const retrieved = await db.getSecrets('proj_123', 'production');
    assert.deepEqual(retrieved, secretRecord);
  });
});

