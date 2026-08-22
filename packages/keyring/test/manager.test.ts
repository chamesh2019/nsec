import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialStore, KeyringUnavailableError } from '../src/index.js';

describe('createCredentialStore', () => {
  it('creates memory provider when mode=memory', async () => {
    const store = await createCredentialStore({ mode: 'memory' });
    assert.equal(store.name, 'memory');
  });

  it('creates file provider when mode=file', async () => {
    const store = await createCredentialStore({ mode: 'file' });
    assert.equal(store.name, 'file');
  });

  it('defaults to keyring mode and returns provider or throws KeyringUnavailableError', async () => {
    try {
      const store = await createCredentialStore({ mode: 'keyring' });
      assert.equal(store.name, 'keyring');
    } catch (err) {
      assert.ok(err instanceof KeyringUnavailableError);
    }
  });

  it('throws error for invalid mode', async () => {
    await assert.rejects(
      async () => createCredentialStore({ mode: 'invalid' as any }),
      /Unknown storage mode: invalid/
    );
  });
});
