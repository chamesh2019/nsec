import { loadConfig, ZVaultApiClient, type ZVaultConfig } from '@zvault/core';
import { decryptProjectKeyWithUserKey, encryptProjectKeyForUser } from '@zvault/crypto';
import { createCredentialStore, type KeyringStorage } from '@zvault/keyring';

export interface MemberCommandOptions {
  role?: 'admin' | 'developer' | 'viewer';
  environments?: string[];
  configOverride?: Partial<ZVaultConfig>;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export async function executeAddMember(
  email: string,
  options: MemberCommandOptions = {}
): Promise<{ email: string; role: string }> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.configOverride);
  const environments = options.environments || config.environments || ['development'];
  const role = options.role || 'developer';

  const store = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  const creds = await store.getCredentials(config.project);
  if (!creds) {
    throw new Error(`No credentials found for project "${config.project}".`);
  }

  const client = new ZVaultApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
  });

  // 1. Fetch target user public encryption key
  const targetUser = await client.getUser(email);

  // 2. Decrypt project key for each shared environment and re-encrypt with target user's public key
  const environmentKeys: Record<string, { encryptedKey: string; algorithm: 'RSA-OAEP-4096' }> = {};

  for (const env of environments) {
    try {
      const secretsRes = await client.fetchSecrets(config.project, env);
      const projectKey = decryptProjectKeyWithUserKey(secretsRes.encryptedProjectKey, creds.privateKey);
      environmentKeys[env] = encryptProjectKeyForUser(projectKey, targetUser.publicKeys.encryptionKey);
    } catch {
      // If environment has no secrets yet, skip
    }
  }

  await client.addMember({
    projectId: config.project,
    email,
    role,
    environments,
    environmentKeys
  });

  return { email, role };
}
