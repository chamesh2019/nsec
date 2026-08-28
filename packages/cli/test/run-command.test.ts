import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeRun } from '../src/commands/run.js';
import { SecretsCache } from '../src/cache.js';
import {
  generateUserKeyPair,
  generateProjectKey,
  encryptProjectSecrets,
  encryptProjectKeyForUser
} from '@nsec/crypto';
import { createCredentialStore } from '@nsec/keyring';
import http from 'node:http';

describe('executeRun Command & Offline Caching', () => {
  it('fetches online, populates cache, and falls back to cache when server is offline', async () => {
    const userKeys = await generateUserKeyPair();
    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_HOST: 'zvault_db_host' }, projectKey);
    const encProjectKey = encryptProjectKeyForUser(projectKey, userKeys.encryption.publicKey);

    // Mock server returning encrypted secrets
    const server = http.createServer((req, res) => {
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
    const serverUrl = `http://localhost:${(server.address() as any).port}`;

    // Setup memory credentials
    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('test_proj', {
      keyId: 'key_1',
      privateKey: userKeys.encryption.privateKey,
      publicKey: userKeys.signing.publicKey,
      token: userKeys.signing.privateKey
    });

    const tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nullsec-run-cache-test-'));
    const cacheStore = new SecretsCache(tmpCacheDir);

    // 1. First run: Online (should fetch from server and populate cache)
    const exitCodeOnline = await executeRun({
      configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
      credentialStore: store,
      signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
      encryptionPrivateKey: userKeys.encryption.privateKey,
      cacheStore,
      command: [process.execPath, '-e', 'if (process.env.DB_HOST !== "zvault_db_host") process.exit(1);']
    });
    assert.equal(exitCodeOnline, 0);

    // Verify cache file was written
    const cachedEntry = await cacheStore.get(serverUrl, 'test_proj', 'development');
    assert.ok(cachedEntry);
    assert.equal(cachedEntry.version, 1);

    // 2. Stop server (server goes offline)
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    // 3. Second run: Server unreachable -> transparent fallback to cache
    const exitCodeOfflineFallback = await executeRun({
      configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
      credentialStore: store,
      signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
      encryptionPrivateKey: userKeys.encryption.privateKey,
      cacheStore,
      command: [process.execPath, '-e', 'if (process.env.DB_HOST !== "zvault_db_host") process.exit(1);']
    });
    assert.equal(exitCodeOfflineFallback, 0);

    // 4. Third run: Explicit --offline flag
    const exitCodeExplicitOffline = await executeRun({
      configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
      credentialStore: store,
      signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
      encryptionPrivateKey: userKeys.encryption.privateKey,
      cacheStore,
      offline: true,
      command: [process.execPath, '-e', 'if (process.env.DB_HOST !== "zvault_db_host") process.exit(1);']
    });
    assert.equal(exitCodeExplicitOffline, 0);

    // Clean up
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('fails when offline and no cache is available', async () => {
    const userKeys = await generateUserKeyPair();
    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('test_proj', {
      keyId: 'key_1',
      privateKey: userKeys.encryption.privateKey,
      publicKey: userKeys.signing.publicKey,
      token: userKeys.signing.privateKey
    });

    const tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nullsec-run-cache-test-'));
    const cacheStore = new SecretsCache(tmpCacheDir);

    // Dead port server URL
    const deadServerUrl = 'http://localhost:59999';

    await assert.rejects(
      async () => {
        await executeRun({
          configOverride: { project: 'test_proj', serverUrl: deadServerUrl, storage: 'memory' },
          credentialStore: store,
          signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
          encryptionPrivateKey: userKeys.encryption.privateKey,
          cacheStore,
          command: [process.execPath, '-e', 'process.exit(0)']
        });
      },
      /no cached secrets found|Server unreachable/i
    );

    // Explicit offline with no cache
    await assert.rejects(
      async () => {
        await executeRun({
          configOverride: { project: 'test_proj', serverUrl: deadServerUrl, storage: 'memory' },
          credentialStore: store,
          signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
          encryptionPrivateKey: userKeys.encryption.privateKey,
          cacheStore,
          offline: true,
          command: [process.execPath, '-e', 'process.exit(0)']
        });
      },
      /No cached secrets found for project/i
    );

    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('respects --no-cache option and bypasses cache read & write', async () => {
    const userKeys = await generateUserKeyPair();
    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_HOST: 'zvault_db_host' }, projectKey);
    const encProjectKey = encryptProjectKeyForUser(projectKey, userKeys.encryption.publicKey);

    const server = http.createServer((req, res) => {
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
    const serverUrl = `http://localhost:${(server.address() as any).port}`;

    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('test_proj', {
      keyId: 'key_1',
      privateKey: userKeys.encryption.privateKey,
      publicKey: userKeys.signing.publicKey,
      token: userKeys.signing.privateKey
    });

    const tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nullsec-run-cache-test-'));
    const cacheStore = new SecretsCache(tmpCacheDir);

    // Run online with noCache: true
    const exitCode = await executeRun({
      configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
      credentialStore: store,
      signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
      encryptionPrivateKey: userKeys.encryption.privateKey,
      cacheStore,
      noCache: true,
      command: [process.execPath, '-e', 'if (process.env.DB_HOST !== "zvault_db_host") process.exit(1);']
    });
    assert.equal(exitCode, 0);

    // Verify cache was NOT created
    const cached = await cacheStore.get(serverUrl, 'test_proj', 'development');
    assert.equal(cached, null);

    server.close();
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('does NOT fallback to cache when server returns 401 Unauthorized', async () => {
    const userKeys = await generateUserKeyPair();
    const projectKey = generateProjectKey();
    const secretsPayload = encryptProjectSecrets({ DB_HOST: 'zvault_db_host' }, projectKey);
    const encProjectKey = encryptProjectKeyForUser(projectKey, userKeys.encryption.publicKey);

    // 401 server
    const server = http.createServer((req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Unauthorized signature or revoked key' }));
    });
    await new Promise<void>((r) => server.listen(0, r));
    const serverUrl = `http://localhost:${(server.address() as any).port}`;

    const store = await createCredentialStore({ mode: 'memory' });
    await store.saveCredentials('test_proj', {
      keyId: 'key_1',
      privateKey: userKeys.encryption.privateKey,
      publicKey: userKeys.signing.publicKey,
      token: userKeys.signing.privateKey
    });

    const tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nullsec-run-cache-test-'));
    const cacheStore = new SecretsCache(tmpCacheDir);

    // Seed cache beforehand
    await cacheStore.set(serverUrl, 'test_proj', 'development', {
      projectId: 'test_proj',
      environment: 'development',
      serverUrl,
      secretsPayload,
      encryptedProjectKey: encProjectKey,
      version: 1,
      updatedAt: new Date().toISOString()
    });

    // Run online against 401 server -> should throw 401 and NOT fallback
    await assert.rejects(
      async () => {
        await executeRun({
          configOverride: { project: 'test_proj', serverUrl, storage: 'memory' },
          credentialStore: store,
          signingKeys: { privateKey: userKeys.signing.privateKey, publicKey: userKeys.signing.publicKey },
          encryptionPrivateKey: userKeys.encryption.privateKey,
          cacheStore,
          command: [process.execPath, '-e', 'process.exit(0)']
        });
      },
      /Unauthorized/i
    );

    server.close();
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });
});
