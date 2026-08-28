import { generateUserKeyPair } from '@nsec/crypto';
import { loadConfig, NullSecApiClient } from '@nsec/core';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { normalizeServerUrl, serverAccountKey } from './url-helpers.js';
import { getRequiredCredentials } from './auth-helper.js';

export interface RotateKeysCommandOptions {
  serverUrl?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export async function executeRotateKeys(
  options: RotateKeysCommandOptions = {}
): Promise<{ email: string; serverUrl: string }> {
  const cwd = options.cwd || process.cwd();
  let serverUrl = options.serverUrl;
  let storageMode = options.storage || 'keyring';

  try {
    const config = await loadConfig(cwd);
    serverUrl = serverUrl || config.serverUrl;
    storageMode = options.storage || config.storage || 'keyring';
  } catch {
    serverUrl = serverUrl || 'https://nsec.chames.dev';
  }

  const normServerUrl = normalizeServerUrl(serverUrl);
  const store = options.credentialStore || (await createCredentialStore({ mode: storageMode }));
  const existingCreds = await getRequiredCredentials('global', store, normServerUrl);

  // 1. Generate brand new local keypair
  const newKeys = await generateUserKeyPair();

  // 2. Authenticate to server with existing keys and update public keys
  const client = new NullSecApiClient({
    serverUrl: normServerUrl,
    signingKeys: {
      privateKey: existingCreds.token || existingCreds.privateKey,
      publicKey: existingCreds.publicKey || ''
    }
  });

  await client.rotateKeys({
    publicKeys: {
      signingKey: newKeys.signing.publicKey,
      encryptionKey: newKeys.encryption.publicKey
    }
  });

  // 3. Save new keys to local credential store
  const serverKey = serverAccountKey(normServerUrl);
  const updatedPayload = {
    keyId: `key_${Date.now()}`,
    email: existingCreds.email,
    serverUrl: normServerUrl,
    privateKey: newKeys.encryption.privateKey,
    publicKey: newKeys.signing.publicKey,
    token: newKeys.signing.privateKey,
    createdAt: new Date().toISOString()
  };

  await store.saveCredentials(serverKey, updatedPayload);
  const defaultCreds = await store.getCredentials('default');
  if (defaultCreds?.email === existingCreds.email) {
    await store.saveCredentials('default', updatedPayload);
  }

  return { email: existingCreds.email || '', serverUrl: normServerUrl };
}
