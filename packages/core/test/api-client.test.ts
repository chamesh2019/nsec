import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generateUserKeyPair, verifySignature } from '@nsec/crypto';
import { ZVaultApiClient } from '../src/client/index.js';

describe('ZVaultApiClient', () => {
  let server: http.Server;
  let serverUrl: string;
  let lastReceivedHeaders: http.IncomingHttpHeaders;
  let lastReceivedBody: any;

  before(async () => {
    server = http.createServer(async (req, res) => {
      lastReceivedHeaders = req.headers;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf-8');
      lastReceivedBody = raw ? JSON.parse(raw) : null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url?.includes('/api/v1/projects/proj_123/environments/production/secrets')) {
        res.end(JSON.stringify({
          projectId: 'proj_123',
          environment: 'production',
          secretsPayload: { ciphertext: 'YWVzX2NpcGhlcg==', iv: 'MTIzNDU2Nzg5MDEy', tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==', version: 1 },
          encryptedProjectKey: { encryptedKey: 'ZW5jcnlwdGVkX2tleQ==', algorithm: 'RSA-OAEP-4096' },
          version: 1,
          updatedAt: new Date().toISOString()
        }));
      } else if (req.url?.includes('/api/v1/projects')) {
        res.end(JSON.stringify({ id: 'proj_123', name: 'demo-app', environments: ['development', 'production'], members: [], createdAt: '', updatedAt: '' }));
      } else {
        res.end(JSON.stringify({ success: true, version: 1 }));
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    serverUrl = `http://localhost:${port}`;
  });

  after(() => {
    server.close();
  });

  it('sends signed requests with signature and timestamp headers', async () => {
    const userKeys = await generateUserKeyPair();
    const client = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userKeys.signing.privateKey,
        publicKey: userKeys.signing.publicKey
      }
    });

    const project = await client.getProject('proj_123');
    assert.equal(project.id, 'proj_123');

    assert.ok(lastReceivedHeaders['x-zvault-signature']);
    assert.ok(lastReceivedHeaders['x-zvault-public-key']);
    assert.ok(lastReceivedHeaders['x-zvault-timestamp']);
  });

  it('supports service token authentication', async () => {
    const client = new ZVaultApiClient({
      serverUrl,
      serviceToken: 'zv_st_test_token_12345'
    });

    await client.getProject('proj_123');
    assert.equal(lastReceivedHeaders['authorization'], 'Bearer zv_st_test_token_12345');
  });

  it('fetches environment secrets using typed schema', async () => {
    const userKeys = await generateUserKeyPair();
    const client = new ZVaultApiClient({
      serverUrl,
      signingKeys: {
        privateKey: userKeys.signing.privateKey,
        publicKey: userKeys.signing.publicKey
      }
    });

    const secretsRes = await client.fetchSecrets('proj_123', 'production');
    assert.equal(secretsRes.projectId, 'proj_123');
    assert.equal(secretsRes.environment, 'production');
    assert.equal(secretsRes.encryptedProjectKey.algorithm, 'RSA-OAEP-4096');
  });
});
