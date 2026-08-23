import fs from 'node:fs/promises';
import path from 'node:path';
import { generateUserKeyPair } from '@nsec/crypto';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { NullSecApiClient, type NullSecConfig } from '@nsec/core';
import { normalizeServerUrl, serverAccountKey } from './url-helpers.js';

export interface ExecuteInitOptions {
  project?: string;
  serverUrl?: string;
  email?: string;
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export async function executeInit(options: ExecuteInitOptions = {}): Promise<{ project: string; email: string }> {
  const cwd = options.cwd || process.cwd();
  const projectName = options.project || path.basename(cwd).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const storageMode = options.storage || 'keyring';
  const store = options.credentialStore || (await createCredentialStore({ mode: storageMode }));

  // 1. Determine serverUrl and check for existing identity for this server or default
  const defaultCreds = await store.getCredentials('default');
  const serverUrl = normalizeServerUrl(options.serverUrl || defaultCreds?.serverUrl || 'https://nsec.chames.dev');
  const serverKey = serverAccountKey(serverUrl);
  const existingCreds = (await store.getCredentials(serverKey)) || defaultCreds;

  const email = options.email || existingCreds?.email;

  if (!email) {
    throw new Error(
      `No registered identity found on this machine for server "${serverUrl}".\n\n` +
      `Please register your identity with the server first:\n` +
      `  \x1b[36mnsec register <your-email> --server ${serverUrl}\x1b[0m\n\n` +
      `Or initialize with your email:\n` +
      `  \x1b[36mnsec init --email <your-email> --server ${serverUrl}\x1b[0m\n`
    );
  }

  let signingPrivateKey: string;
  let signingPublicKey: string;
  let encryptionPrivateKey: string;
  let encryptionPublicKey: string;

  if (existingCreds && (!options.email || options.email === existingCreds.email)) {
    // Reuse existing registered identity on this machine
    signingPrivateKey = existingCreds.token || existingCreds.privateKey;
    signingPublicKey = existingCreds.publicKey || '';
    encryptionPrivateKey = existingCreds.privateKey;
    encryptionPublicKey = '';
  } else {
    // Generate new keypair if registering a new email
    const userKeys = await generateUserKeyPair();
    signingPrivateKey = userKeys.signing.privateKey;
    signingPublicKey = userKeys.signing.publicKey;
    encryptionPrivateKey = userKeys.encryption.privateKey;
    encryptionPublicKey = userKeys.encryption.publicKey;
  }

  // 2. Register user & create project on the server (Mandatory)
  const client = new NullSecApiClient({
    serverUrl,
    signingKeys: {
      privateKey: signingPrivateKey,
      publicKey: signingPublicKey
    }
  });

  if (encryptionPublicKey) {
    await client.registerUser({
      email,
      publicKeys: {
        signingKey: signingPublicKey,
        encryptionKey: encryptionPublicKey
      }
    });
  }

  try {
    await client.createProject(projectName, ['development', 'staging', 'production']);
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err);
    if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate')) {
      console.warn(`\x1b[33mNote:\x1b[0m Server sync pending with ${serverUrl} (${msg})`);
    }
  }

  // 3. Save server identity credentials (no redundant per-project key duplication)
  const credentialsPayload = {
    keyId: `key_${Date.now()}`,
    email,
    serverUrl,
    privateKey: encryptionPrivateKey,
    publicKey: signingPublicKey,
    token: signingPrivateKey,
    createdAt: new Date().toISOString()
  };

  await store.saveCredentials(serverKey, credentialsPayload);
  if (!defaultCreds) {
    await store.saveCredentials('default', credentialsPayload);
  }

  // 4. Write local nullsec.config.json
  const configContent: NullSecConfig = {
    project: projectName,
    defaultEnvironment: 'development',
    serverUrl,
    environments: ['development', 'staging', 'production'],
    storage: storageMode
  };

  const configPath = path.join(cwd, 'nullsec.config.json');
  await fs.writeFile(configPath, JSON.stringify(configContent, null, 2), 'utf-8');

  return { project: projectName, email };
}
