import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteDatabaseAdapter } from '../src/db/sqlite-adapter.js';
import type { UserDTO, ProjectDTO } from '@nsec/core';

describe('SqliteDatabaseAdapter', () => {
  it('saves and retrieves users, invites, projects, and secrets', async () => {
    const db = new SqliteDatabaseAdapter(':memory:');

    // 1. Users & Roles
    const user: UserDTO = {
      id: 'usr_sqlite_1',
      email: 'sqlite-admin@company.com',
      role: 'admin',
      publicKeys: {
        signingKey: 'ed25519-pub-key-1',
        encryptionKey: 'rsa-pub-key-1'
      },
      createdAt: new Date().toISOString()
    };

    await db.saveUser(user);
    const fetchedUser = await db.getUserByEmail('sqlite-admin@company.com');
    assert.equal(fetchedUser?.id, 'usr_sqlite_1');
    assert.equal(fetchedUser?.role, 'admin');

    const totalUsers = await db.countUsers();
    assert.equal(totalUsers, 1);

    await db.updateUserRole('usr_sqlite_1', 'member');
    const updatedUser = await db.getUserById('usr_sqlite_1');
    assert.equal(updatedUser?.role, 'member');

    // 2. Invites
    await db.saveInviteToken({
      id: 'inv_1',
      email: 'invitee@company.com',
      tokenHash: 'hash_123',
      role: 'member',
      invitedBy: 'admin@company.com',
      createdAt: new Date().toISOString()
    });

    const invite = await db.getInviteTokenByHash('hash_123');
    assert.equal(invite?.email, 'invitee@company.com');

    const invites = await db.listInviteTokens();
    assert.equal(invites.length, 1);

    await db.deleteInviteToken('inv_1');
    const afterDelete = await db.getInviteTokenByHash('hash_123');
    assert.equal(afterDelete, null);

    // 3. Projects & Secrets
    const project: ProjectDTO = {
      id: 'proj_1',
      name: 'Project Alpha',
      environments: ['development', 'production'],
      members: [
        {
          userId: 'usr_sqlite_1',
          email: 'sqlite-admin@company.com',
          role: 'admin',
          environments: ['development', 'production'],
          joinedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.saveProject(project);
    const fetchedProj = await db.getProject('proj_1');
    assert.equal(fetchedProj?.name, 'Project Alpha');
    assert.equal(fetchedProj?.members.length, 1);

    await db.saveSecrets({
      projectId: 'proj_1',
      environment: 'production',
      secretsPayload: {
        ciphertext: 'cipher_data',
        iv: 'iv_data',
        tag: 'tag_data'
      },
      projectKeys: {
        usr_sqlite_1: {
          encryptedKey: 'enc_key_1',
          algorithm: 'RSA-OAEP-4096'
        }
      },
      version: 1,
      updatedAt: new Date().toISOString()
    });

    const secrets = await db.getSecrets('proj_1', 'production');
    assert.equal(secrets?.secretsPayload.ciphertext, 'cipher_data');
    assert.equal(secrets?.projectKeys['usr_sqlite_1'].encryptedKey, 'enc_key_1');
  });
});
