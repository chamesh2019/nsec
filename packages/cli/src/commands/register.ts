import { generateUserKeyPair } from '@nsec/crypto';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { NullSecApiClient, loadConfig } from '@nsec/core';
import { normalizeServerUrl, serverAccountKey } from './url-helpers.js';

export interface RegisterCommandOptions {
  serverUrl?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  project?: string;
  token?: string;
  skipServerSync?: boolean;
}

export async function executeRegister(
  email: string,
  options: RegisterCommandOptions = {}
): Promise<{ email: string; serverUrl: string; role?: string }> {
  let serverUrl = options.serverUrl;
  let project = options.project || 'global';
  let storageMode = options.storage || 'keyring';

  try {
    const config = await loadConfig();
    serverUrl = serverUrl || config.serverUrl;
    project = options.project || config.project;
    storageMode = options.storage || config.storage || 'keyring';
  } catch {
    serverUrl = serverUrl || 'http://localhost:4000';
  }

  const normServerUrl = normalizeServerUrl(serverUrl);

  // 1. Generate local User KeyPair (Ed25519 signing + RSA-4096 encryption)
  const userKeys = await generateUserKeyPair();

  let registeredRole: string | undefined;

  // 2. Register public keys on server
  if (!options.skipServerSync) {
    const client = new NullSecApiClient({
      serverUrl: normServerUrl,
      signingKeys: {
        privateKey: userKeys.signing.privateKey,
        publicKey: userKeys.signing.publicKey
      }
    });

    const user = await client.registerUser({
      email,
      token: options.token,
      publicKeys: {
        signingKey: userKeys.signing.publicKey,
        encryptionKey: userKeys.encryption.publicKey
      }
    });
    registeredRole = user.role;
  }

  // 3. Securely store private keys in OS Keyring or 0o600 file upon successful registration
  const store = options.credentialStore || (await createCredentialStore({ mode: storageMode }));
  const serverKey = serverAccountKey(normServerUrl);
  const credentialsPayload = {
    keyId: `key_${Date.now()}`,
    email,
    serverUrl: normServerUrl,
    privateKey: userKeys.encryption.privateKey,
    publicKey: userKeys.signing.publicKey,
    token: userKeys.signing.privateKey,
    createdAt: new Date().toISOString()
  };

  await store.saveCredentials(serverKey, credentialsPayload);
  await store.saveCredentials('default', credentialsPayload);

  return { email, serverUrl: normServerUrl, role: registeredRole };
}

