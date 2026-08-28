import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SecretsCache, isNetworkError, type CachedSecretsPayload } from '../src/cache.js';
import { ApiClientError, AuthenticationError } from '@nsec/core';

describe('SecretsCache Engine', () => {
  let tmpDir: string;
  let cache: SecretsCache;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nullsec-cache-test-'));
    cache = new SecretsCache(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('correctly builds sanitized cache file paths', () => {
    const filePath = cache.getCacheFilePath('https://api.zvault.io:8080/v1', 'my-project', 'production');
    assert.match(filePath, /api_zvault_io_8080/);
    assert.match(filePath, /my-project/);
    assert.match(filePath, /production\.json$/);
  });

  it('stores, retrieves, and updates cached payloads atomically', async () => {
    const payload: Omit<CachedSecretsPayload, 'cachedAt'> = {
      projectId: 'proj_1',
      environment: 'development',
      serverUrl: 'http://localhost:3000',
      secretsPayload: { ciphertext: 'encrypted_payload_data', iv: 'iv123', tag: 'tag123', version: 1 },
      encryptedProjectKey: { encryptedKey: 'enc_proj_key_data', algorithm: 'RSA-OAEP-4096' },
      version: 1,
      updatedAt: new Date().toISOString()
    };

    // Initially null
    const initial = await cache.get('http://localhost:3000', 'proj_1', 'development');
    assert.equal(initial, null);

    // Save
    await cache.set('http://localhost:3000', 'proj_1', 'development', payload);

    // Retrieve
    const cached = await cache.get('http://localhost:3000', 'proj_1', 'development');
    assert.ok(cached);
    assert.equal(cached.projectId, 'proj_1');
    assert.equal(cached.environment, 'development');
    assert.deepEqual(cached.secretsPayload, { ciphertext: 'encrypted_payload_data', iv: 'iv123', tag: 'tag123', version: 1 });
    assert.deepEqual(cached.encryptedProjectKey, { encryptedKey: 'enc_proj_key_data', algorithm: 'RSA-OAEP-4096' });
    assert.equal(cached.version, 1);
    assert.ok(cached.cachedAt);

    // Check permissions on POSIX
    if (process.platform !== 'win32') {
      const filePath = cache.getCacheFilePath('http://localhost:3000', 'proj_1', 'development');
      const stat = await fs.stat(filePath);
      assert.equal(stat.mode & 0o777, 0o600);
    }

    // Update
    await cache.set('http://localhost:3000', 'proj_1', 'development', {
      ...payload,
      version: 2,
      secretsPayload: { ciphertext: 'encrypted_payload_v2', iv: 'iv456', tag: 'tag456', version: 2 }
    });

    const updated = await cache.get('http://localhost:3000', 'proj_1', 'development');
    assert.ok(updated);
    assert.equal(updated.version, 2);
    assert.equal(updated.secretsPayload.ciphertext, 'encrypted_payload_v2');
  });

  it('deletes cached entries properly', async () => {
    await cache.set('http://localhost:3000', 'proj_1', 'development', {
      projectId: 'proj_1',
      environment: 'development',
      serverUrl: 'http://localhost:3000',
      secretsPayload: { ciphertext: 'abc', iv: 'iv', tag: 'tag', version: 1 },
      encryptedProjectKey: { encryptedKey: 'xyz', algorithm: 'RSA-OAEP-4096' },
      version: 1,
      updatedAt: new Date().toISOString()
    });

    const deleted = await cache.delete('http://localhost:3000', 'proj_1', 'development');
    assert.equal(deleted, true);

    const check = await cache.get('http://localhost:3000', 'proj_1', 'development');
    assert.equal(check, null);

    const deleteAgain = await cache.delete('http://localhost:3000', 'proj_1', 'development');
    assert.equal(deleteAgain, false);
  });

  it('handles corrupted cache files gracefully without crashing', async () => {
    const filePath = cache.getCacheFilePath('http://localhost:3000', 'proj_1', 'development');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{ invalid json');

    const result = await cache.get('http://localhost:3000', 'proj_1', 'development');
    assert.equal(result, null);
  });
});

describe('isNetworkError Helper', () => {
  it('identifies TypeError: fetch failed', () => {
    const fetchError = new TypeError('fetch failed');
    assert.equal(isNetworkError(fetchError), true);
  });

  it('identifies network system error codes', () => {
    const codes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'];
    for (const code of codes) {
      const err = new Error(`Connection error with code ${code}`) as any;
      err.code = code;
      assert.equal(isNetworkError(err), true, `Expected code ${code} to be recognized as network error`);
    }
  });

  it('identifies ApiClientError with 0 or undefined status', () => {
    const apiErr = new ApiClientError('Network failed', 0);
    assert.equal(isNetworkError(apiErr), true);
  });

  it('does NOT identify HTTP 401, 403, 404, or 500 as network errors', () => {
    const authErr = new AuthenticationError('Unauthorized');
    assert.equal(isNetworkError(authErr), false);

    const api404 = new ApiClientError('Not found', 404);
    assert.equal(isNetworkError(api404), false);

    const api500 = new ApiClientError('Server error', 500);
    assert.equal(isNetworkError(api500), false);

    const normalErr = new Error('Some logic error');
    assert.equal(isNetworkError(normalErr), false);
  });
});
