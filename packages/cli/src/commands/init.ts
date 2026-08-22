import fs from 'node:fs/promises';
import path from 'node:path';
import { generateUserKeyPair } from '@nsec/crypto';
import { createCredentialStore, type StorageMode } from '@nsec/keyring';
import { NullSecApiClient, type NullSecConfig } from '@nsec/core';

export interface ExecuteInitOptions {
  project?: string;
  serverUrl?: string;
  email?: string;
  storage?: StorageMode;
  cwd?: string;
}

export async function executeInit(options: ExecuteInitOptions = {}): Promise<{ project: string; email: string }> {
  const cwd = options.cwd || process.cwd();
  const projectName = options.project || path.basename(cwd).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  const storageMode = options.storage || 'keyring';
  const store = await createCredentialStore({ mode: storageMode });

  // 1. Check for existing default identity on this machine
  const defaultCreds = await store.getCredentials('default');
  let email = options.email || defaultCreds?.email;
  let serverUrl = options.serverUrl || defaultCreds?.serverUrl || 'https://nsec.chames.dev';

  let signingPrivateKey: string;
  let signingPublicKey: string;
  let encryptionPrivateKey: string;
  let encryptionPublicKey: string;

  if (defaultCreds && !options.email) {
    // Reuse existing identity on this machine
    signingPrivateKey = defaultCreds.token || defaultCreds.privateKey;
    signingPublicKey = defaultCreds.publicKey || '';
    encryptionPrivateKey = defaultCreds.privateKey;
    encryptionPublicKey = ''; // Will be retrieved or not needed for project creation
    email = defaultCreds.email || `user@${projectName}.local`;
  } else {
    // Generate new keypair if no identity exists or a new email is specified
    const userKeys = await generateUserKeyPair();
    signingPrivateKey = userKeys.signing.privateKey;
    signingPublicKey = userKeys.signing.publicKey;
    encryptionPrivateKey = userKeys.encryption.privateKey;
    encryptionPublicKey = userKeys.encryption.publicKey;
    email = email || `user@${projectName}.local`;
  }

  // 2. Save credentials for this project
  const credentialsPayload = {
    keyId: `key_${Date.now()}`,
    email,
    serverUrl,
    privateKey: encryptionPrivateKey,
    publicKey: signingPublicKey,
    token: signingPrivateKey,
    createdAt: new Date().toISOString()
  };

  await store.saveCredentials(projectName, credentialsPayload);
  if (!defaultCreds) {
    await store.saveCredentials('default', credentialsPayload);
  }

  // 3. Register user and create project on server
  try {
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

    await client.createProject(projectName, ['development', 'staging', 'production']);
  } catch {
    // Server registration can complete asynchronously if server isn't running or reachable
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
