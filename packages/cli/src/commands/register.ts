import { generateUserKeyPair } from '@nsec/crypto';
import { createCredentialStore, type StorageMode } from '@nsec/keyring';
import { NullSecApiClient, loadConfig } from '@nsec/core';

export interface RegisterCommandOptions {
  serverUrl?: string;
  storage?: StorageMode;
  project?: string;
}

export async function executeRegister(
  email: string,
  options: RegisterCommandOptions = {}
): Promise<{ email: string; serverUrl: string }> {
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

  // 1. Generate local User KeyPair (Ed25519 signing + RSA-4096 encryption)
  const userKeys = await generateUserKeyPair();

  // 2. Securely store private keys in OS Keyring or 0o600 file
  const store = await createCredentialStore({ mode: storageMode });
  const credentialsPayload = {
    keyId: `key_${Date.now()}`,
    email,
    serverUrl,
    privateKey: userKeys.encryption.privateKey,
    publicKey: userKeys.signing.publicKey,
    token: userKeys.signing.privateKey,
    createdAt: new Date().toISOString()
  };

  await store.saveCredentials(project, credentialsPayload);
  await store.saveCredentials('default', credentialsPayload);

  // 3. Register public keys on server
  const client = new NullSecApiClient({
    serverUrl,
    signingKeys: {
      privateKey: userKeys.signing.privateKey,
      publicKey: userKeys.signing.publicKey
    }
  });

  await client.registerUser({
    email,
    publicKeys: {
      signingKey: userKeys.signing.publicKey,
      encryptionKey: userKeys.encryption.publicKey
    }
  });

  return { email, serverUrl };
}
