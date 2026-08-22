import { loadConfig, ZVaultApiClient, type ZVaultConfig } from '@zvault/core';
import {
  generateProjectKey,
  encryptProjectSecrets,
  decryptProjectSecrets,
  encryptProjectKeyForUser,
  decryptProjectKeyWithUserKey
} from '@zvault/crypto';
import { createCredentialStore, type KeyringStorage } from '@zvault/keyring';

export interface SecretCommandOptions {
  env?: string;
  configOverride?: Partial<ZVaultConfig>;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export async function executeSet(
  key: string,
  value: string,
  options: SecretCommandOptions = {}
): Promise<{ key: string; version: number }> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'development';

  const store = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  const creds = await store.getCredentials(config.project);
  if (!creds) {
    throw new Error(`No credentials found for project "${config.project}".`);
  }

  const client = new ZVaultApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
  });

  let currentSecrets: Record<string, string> = {};
  let projectKey: string;

  try {
    const existing = await client.fetchSecrets(config.project, environment);
    projectKey = decryptProjectKeyWithUserKey(existing.encryptedProjectKey, creds.privateKey);
    currentSecrets = decryptProjectSecrets(existing.secretsPayload, projectKey);
  } catch {
    // If first secret, generate new Project Key for this environment
    projectKey = generateProjectKey();
  }

  currentSecrets[key] = value;

  const secretsPayload = encryptProjectSecrets(currentSecrets, projectKey);

  // Lookup user info to get user id for projectKeys mapping
  const user = await client.getUser(creds.publicKey || '');
  const encryptedKey = encryptProjectKeyForUser(projectKey, user.publicKeys.encryptionKey);

  const res = await client.uploadSecrets({
    projectId: config.project,
    environment,
    secretsPayload,
    projectKeys: { [user.id]: encryptedKey }
  });

  return { key, version: res.version };
}

export async function executeGet(
  key?: string,
  options: SecretCommandOptions = {}
): Promise<Record<string, string> | string> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'development';

  const store = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  const creds = await store.getCredentials(config.project);
  if (!creds) {
    throw new Error(`No credentials found for project "${config.project}".`);
  }

  const client = new ZVaultApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
  });

  const existing = await client.fetchSecrets(config.project, environment);
  const projectKey = decryptProjectKeyWithUserKey(existing.encryptedProjectKey, creds.privateKey);
  const secrets = decryptProjectSecrets(existing.secretsPayload, projectKey);

  if (key) {
    if (!(key in secrets)) {
      throw new Error(`Secret "${key}" not found in environment "${environment}".`);
    }
    return secrets[key];
  }

  return secrets;
}
