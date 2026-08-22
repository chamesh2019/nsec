import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileStorageProvider } from '../src/providers/file.js';
import type { KeyringCredentials } from '../src/types.js';

describe('FileStorageProvider', () => {
  let tempDir: string;
  let filePath: string;
  let provider: FileStorageProvider;

  const sampleCreds: KeyringCredentials = {
    keyId: 'key_file_test',
    privateKey: 'file_sk_secret_123',
    publicKey: 'file_pk_secret_123',
    serverUrl: 'https://api.zvault.dev'
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zvault-file-test-'));
    filePath = path.join(tempDir, 'credentials.json');
    provider = new FileStorageProvider(filePath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('saves credentials with 0o600 permissions on POSIX', async () => {
    await provider.saveCredentials('my_project', sampleCreds);
    const retrieved = await provider.getCredentials('my_project');
    assert.deepEqual(retrieved, sampleCreds);

    if (process.platform !== 'win32') {
      const stats = await fs.stat(filePath);
      const mode = stats.mode & 0o777;
      assert.equal(mode, 0o600, 'File must have 0o600 permissions');
    }
  });

  it('saves multiple accounts in the same file', async () => {
    const creds2: KeyringCredentials = {
      keyId: 'key_2',
      privateKey: 'sk_2'
    };
    await provider.saveCredentials('proj_1', sampleCreds);
    await provider.saveCredentials('proj_2', creds2);

    assert.deepEqual(await provider.getCredentials('proj_1'), sampleCreds);
    assert.deepEqual(await provider.getCredentials('proj_2'), creds2);
  });

  it('deletes specific account without affecting others', async () => {
    const creds2: KeyringCredentials = {
      keyId: 'key_2',
      privateKey: 'sk_2'
    };
    await provider.saveCredentials('proj_1', sampleCreds);
    await provider.saveCredentials('proj_2', creds2);

    const deleted = await provider.deleteCredentials('proj_1');
    assert.equal(deleted, true);
    assert.equal(await provider.getCredentials('proj_1'), null);
    assert.deepEqual(await provider.getCredentials('proj_2'), creds2);
  });

  it('returns null when file does not exist yet', async () => {
    const retrieved = await provider.getCredentials('non_existent');
    assert.equal(retrieved, null);
  });
});
