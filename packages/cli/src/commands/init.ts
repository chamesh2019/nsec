import fs from 'node:fs/promises';
import path from 'node:path';
import { generateUserKeyPair } from '@nsec/crypto';
import { createCredentialStore, type StorageMode } from '@nsec/keyring';
import { ZVaultApiClient, type ZVaultConfig } from '@nsec/core';

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
  const serverUrl = options.serverUrl || 'http://localhost:4000';
  const email = options.email || `dev@${projectName}.local`;
  const storageMode = options.storage || 'keyring';

  // 1. Generate local User KeyPair
  const userKeys = await generateUserKeyPair();

  // 2. Save private key in OS Keyring / file store
  const store = await createCredentialStore({ mode: storageMode });
  await store.saveCredentials(projectName, {
    keyId: `key_${Date.now()}`,
    privateKey: userKeys.encryption.privateKey,
    publicKey: userKeys.signing.publicKey,
    token: userKeys.signing.privateKey
  });

  // 3. Register user and create project on server
  try {
    const client = new ZVaultApiClient({
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

    await client.createProject(projectName, ['development', 'staging', 'production']);
  } catch {
    // Server registration can complete asynchronously if server isn't running at init time
  }

  // 4. Write local zvault.config.json
  const configContent: ZVaultConfig = {
    project: projectName,
    defaultEnvironment: 'development',
    serverUrl,
    environments: ['development', 'staging', 'production'],
    storage: storageMode
  };

  const configPath = path.join(cwd, 'zvault.config.json');
  await fs.writeFile(configPath, JSON.stringify(configContent, null, 2), 'utf-8');

  return { project: projectName, email };
}
