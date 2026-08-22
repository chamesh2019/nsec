import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OSKeyringProvider } from '../src/providers/os.js';
import type { KeyringCredentials } from '../src/types.js';

describe('OSKeyringProvider', () => {
  const testService = 'zvault_test_service';
  const sampleCreds: KeyringCredentials = {
    keyId: 'key_os_test_1',
    privateKey: 'os_sk_secret_123',
    publicKey: 'os_pk_secret_123',
    serverUrl: 'https://api.zvault.dev'
  };

  it('instantiates with custom service name', () => {
    const provider = new OSKeyringProvider(testService);
    assert.equal(provider.name, 'keyring');
  });

  it('validates credentials schema before saving', async () => {
    const provider = new OSKeyringProvider(testService);
    const invalidCreds = { keyId: '' } as unknown as KeyringCredentials;
    await assert.rejects(
      async () => provider.saveCredentials('test', invalidCreds),
      /Invalid credentials/
    );
  });

  it('checks availability without throwing unhandled exceptions', async () => {
    const provider = new OSKeyringProvider(testService);
    const available = await provider.isAvailable();
    assert.equal(typeof available, 'boolean');
  });

  it('saves, retrieves and deletes credentials when available', async () => {
    const provider = new OSKeyringProvider(testService);
    const available = await provider.isAvailable();
    if (!available) {
      return; // Skip native keyring interaction in environments without keyring daemon
    }

    const testAccount = `acc_${Date.now()}`;
    await provider.saveCredentials(testAccount, sampleCreds);
    const retrieved = await provider.getCredentials(testAccount);
    assert.deepEqual(retrieved, sampleCreds);

    const deleted = await provider.deleteCredentials(testAccount);
    assert.equal(deleted, true);
    assert.equal(await provider.getCredentials(testAccount), null);
  });
});
