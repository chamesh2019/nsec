import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateUserKeyPair, generateProjectKey, encryptProjectSecrets, encryptProjectKeyForUser } from '@nsec/crypto';
import { ZVaultApiClient } from '@nsec/core';
import { createHonoServer, serveServer } from '../src/index.js';
import { MemoryDatabaseAdapter } from '../src/db/index.js';

describe('Server REST API Routes', () => {
  let server: any;
  let serverUrl: string;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    const app = createHonoServer({ db });
    const instance = await serveServer(app);
    server = instance.server;
    serverUrl = instance.url;
  });

  after(() => {
    server?.close();
  });



  it('completes full user registration, project creation, secret upload, and secret fetch flow', async () => {
    // 1. User A KeyPair & Client
    const userAKeys = await generateUserKeyPair();
    const clientA = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userAKeys.signing.privateKey,
        publicKey: userAKeys.signing.publicKey
      }
    });

    // 2. Register First User (Admin automatically)
    const adminUser = await clientA.registerUser({
      email: 'admin@zvault.dev',
      publicKeys: {
        signingKey: userAKeys.signing.publicKey,
        encryptionKey: userAKeys.encryption.publicKey
      }
    });
    assert.equal(adminUser.email, 'admin@zvault.dev');
    assert.equal(adminUser.role, 'admin');

    // 3. Attempting to overwrite existing user email without rotation returns 409
    await assert.rejects(
      async () => {
        await clientA.registerUser({
          email: 'admin@zvault.dev',
          publicKeys: {
            signingKey: userAKeys.signing.publicKey,
            encryptionKey: userAKeys.encryption.publicKey
          }
        });
      },
      /already registered/i
    );

    // 4. Attempting to register second user without invite token returns 401
    const userBKeys = await generateUserKeyPair();
    const clientB = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userBKeys.signing.privateKey,
        publicKey: userBKeys.signing.publicKey
      }
    });

    await assert.rejects(
      async () => {
        await clientB.registerUser({
          email: 'developer@zvault.dev',
          publicKeys: {
            signingKey: userBKeys.signing.publicKey,
            encryptionKey: userBKeys.encryption.publicKey
          }
        });
      },
      /requires an invite token/i
    );

    // 5. Admin creates invite for User B
    const invite = await clientA.createInvite({
      email: 'developer@zvault.dev',
      role: 'member'
    });
    assert.ok(invite.token);
    assert.equal(invite.email, 'developer@zvault.dev');
    assert.equal(invite.role, 'member');

    // 6. User B registers using invite token
    const memberUser = await clientB.registerUser({
      email: 'developer@zvault.dev',
      token: invite.token,
      publicKeys: {
        signingKey: userBKeys.signing.publicKey,
        encryptionKey: userBKeys.encryption.publicKey
      }
    });
    assert.equal(memberUser.email, 'developer@zvault.dev');
    assert.equal(memberUser.role, 'member');

    // 7. Reusing consumed invite token returns 401
    const userCKeys = await generateUserKeyPair();
    const clientC = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userCKeys.signing.privateKey,
        publicKey: userCKeys.signing.publicKey
      }
    });

    await assert.rejects(
      async () => {
        await clientC.registerUser({
          email: 'other@zvault.dev',
          token: invite.token,
          publicKeys: {
            signingKey: userCKeys.signing.publicKey,
            encryptionKey: userCKeys.encryption.publicKey
          }
        });
      },
      /Invalid or revoked invite token/i
    );

    // 8. Non-admin cannot create invite
    await assert.rejects(
      async () => {
        await clientB.createInvite({
          email: 'hacker@zvault.dev'
        });
      },
      /Admin role required/i
    );

    // 9. Admin lists users and updates user role
    const usersList = await clientA.listUsers();
    assert.equal(usersList.length, 2);

    const promoted = await clientA.updateUserRole(memberUser.id, 'admin');
    assert.equal(promoted.role, 'admin');

    // 10. Authenticated key rotation
    const newKeys = await generateUserKeyPair();
    const rotated = await clientA.rotateKeys({
      publicKeys: {
        signingKey: newKeys.signing.publicKey,
        encryptionKey: newKeys.encryption.publicKey
      }
    });
    assert.equal(rotated.publicKeys.signingKey, newKeys.signing.publicKey);

    // Create client using rotated keys
    const clientARotated = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: newKeys.signing.privateKey,
        publicKey: newKeys.signing.publicKey
      }
    });

    // 11. Create Project and upload/fetch secrets using rotated client
    const project = await clientARotated.createProject('my-secure-service', ['development', 'production']);
    assert.equal(project.name, 'my-secure-service');

    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_PASS: 'top_secret_123' }, projectKey);
    const encryptedKey = encryptProjectKeyForUser(projectKey, newKeys.encryption.publicKey);

    const uploadRes = await clientARotated.uploadSecrets({
      projectId: project.id,
      environment: 'production',
      secretsPayload,
      projectKeys: { [adminUser.id]: encryptedKey }
    });
    assert.equal(uploadRes.success, true);

    const fetched = await clientARotated.fetchSecrets(project.id, 'production');
    assert.equal(fetched.projectId, project.id);
    assert.equal(fetched.environment, 'production');
    assert.equal(fetched.encryptedProjectKey.encryptedKey, encryptedKey.encryptedKey);
  });
});


