import { loadConfig, NullSecApiClient, type NullSecConfig } from '@nsec/core';
import { createCredentialStore, type KeyringStorage } from '@nsec/keyring';
import { getRequiredCredentials } from './auth-helper.js';

export interface TokenCommandOptions {
  env?: string;
  name?: string;
  configOverride?: Partial<NullSecConfig>;
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
  const creds = await getRequiredCredentials(config.project, store, config.serverUrl);

  const client = new NullSecApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
  });

  const res = await client.createServiceToken(config.project, environment, name);
  return { token: res.token || '', name, environment };
}
