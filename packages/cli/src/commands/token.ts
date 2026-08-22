import { loadConfig, ZVaultApiClient, type ZVaultConfig } from '@nsec/core';
import { createCredentialStore, type KeyringStorage } from '@nsec/keyring';

export interface TokenCommandOptions {
  env?: string;
  name?: string;
  configOverride?: Partial<ZVaultConfig>;
  credentialStore?: KeyringStorage;
  cwd?: string;
}

export async function executeCreateToken(
  options: TokenCommandOptions = {}
): Promise<{ token: string; name: string; environment: string }> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd, options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'production';
  const name = options.name || `CI-Token-${Date.now()}`;

  const store = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  const creds = await store.getCredentials(config.project);
  if (!creds) {
    throw new Error(`No credentials found for project "${config.project}".`);
  }

  const client = new ZVaultApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
  });

  const res = await client.createServiceToken(config.project, environment, name);
  return { token: res.token || '', name, environment };
}
