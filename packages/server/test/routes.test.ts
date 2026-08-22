import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateUserKeyPair, generateProjectKey, encryptProjectSecrets, encryptProjectKeyForUser } from '@chamesh2020/crypto';
import { ZVaultApiClient } from '@chamesh2020/core';
import { createServer } from '../src/server.js';
import { MemoryDatabaseAdapter } from '../src/db/index.js';

describe('Server REST API Routes', () => {
  let app: any;
  let serverUrl: string;

  before(async () => {
    const db = new MemoryDatabaseAdapter();
    app = await createServer({ db });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;
  });

  after(async () => {
    await app.close();
  });

  it('completes full user registration, project creation, secret upload, and secret fetch flow', async () => {
    // 1. User A KeyPair & Client
    const userAKeys = await generateUserKeyPair();
    const client = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userAKeys.signing.privateKey,
        publicKey: userAKeys.signing.publicKey
      }
    });

    // 2. Register User A
    const registeredUser = await client.registerUser({
      email: 'admin@zvault.dev',
      publicKeys: {
        signingKey: userAKeys.signing.publicKey,
        encryptionKey: userAKeys.encryption.publicKey
      }
    });
    assert.equal(registeredUser.email, 'admin@zvault.dev');

    // 3. Create Project
    const project = await client.createProject('my-secure-service', ['development', 'production']);
    assert.equal(project.name, 'my-secure-service');

    // 4. Upload Secrets
    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_PASS: 'top_secret_123' }, projectKey);
    const encryptedKey = encryptProjectKeyForUser(projectKey, userAKeys.encryption.publicKey);

    const uploadRes = await client.uploadSecrets({
      projectId: project.id,
      environment: 'production',
      secretsPayload,
      projectKeys: { [registeredUser.id]: encryptedKey }
    });
    assert.equal(uploadRes.success, true);

    // 5. Fetch Secrets
    const fetched = await client.fetchSecrets(project.id, 'production');
    assert.equal(fetched.projectId, project.id);
    assert.equal(fetched.environment, 'production');
    assert.equal(fetched.encryptedProjectKey.encryptedKey, encryptedKey.encryptedKey);
  });
});
