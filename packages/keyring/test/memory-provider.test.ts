import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageProvider } from '../src/providers/memory.js';
import type { KeyringCredentials } from '../src/types.js';

describe('MemoryStorageProvider', () => {
  let provider: MemoryStorageProvider;
  const sampleCreds: KeyringCredentials = {
    keyId: 'key_123',
    privateKey: 'ed25519_sk_abc',
    publicKey: 'ed25519_pk_abc',
    serverUrl: 'https://api.zvault.dev'
  };

  beforeEach(() => {
    provider = new MemoryStorageProvider();
  });

  it('reports available as true', async () => {
    assert.equal(await provider.isAvailable(), true);
    assert.equal(provider.name, 'memory');
  });

  it('saves and retrieves credentials', async () => {
    await provider.saveCredentials('proj_alpha', sampleCreds);
    const retrieved = await provider.getCredentials('proj_alpha');
    assert.deepEqual(retrieved, sampleCreds);
  });

  it('returns null for non-existent account', async () => {
    const retrieved = await provider.getCredentials('unknown_proj');
    assert.equal(retrieved, null);
  });

  it('deletes credentials cleanly', async () => {
    await provider.saveCredentials('proj_alpha', sampleCreds);
    const deleted = await provider.deleteCredentials('proj_alpha');
    assert.equal(deleted, true);
    assert.equal(await provider.getCredentials('proj_alpha'), null);
  });

  it('returns false when deleting non-existent account', async () => {
    const deleted = await provider.deleteCredentials('unknown_proj');
    assert.equal(deleted, false);
  });
});
