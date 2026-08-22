import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeRun } from '../src/commands/run.js';
import {
  generateUserKeyPair,
  generateProjectKey,
  encryptProjectSecrets,
  encryptProjectKeyForUser
} from '@nsec/crypto';
import { createCredentialStore } from '@nsec/keyring';
import http from 'node:http';

describe('executeRun Command', () => {
  let server: http.Server;
  let serverUrl: string;

  it('fetches, decrypts secrets in memory and runs target command', async () => {
    const userKeys = await generateUserKeyPair();
    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_HOST: 'zvault_db_host' }, projectKey);
    const encProjectKey = encryptProjectKeyForUser(projectKey, userKeys.encryption.publicKey);

    // Mock server returning encrypted secrets
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        projectId: 'test_proj',
        environment: 'development',
        secretsPayload,
        encryptedProjectKey: encProjectKey,
        version: 1,
        updatedAt: new Date().toISOString()
      }));
    });
    await new Promise<void>((r) => server.listen(0, r));
    serverUrl = `http://localhost:${(server.address() as any).port}`;

    // Setup memory credentials
    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('test_proj', {
      keyId: 'key_1',
      privateKey: userKeys.encryption.privateKey,
      publicKey: userKeys.signing.publicKey,
      token: userKeys.signing.privateKey
    });

    const exitCode = await executeRun({
      configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
      credentialStore: store,
      signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
      encryptionPrivateKey: userKeys.encryption.privateKey,
      command: [process.execPath, '-e', 'if (process.env.DB_HOST !== "zvault_db_host") process.exit(1);']
    });

    assert.equal(exitCode, 0);
    server.close();
  });
});
