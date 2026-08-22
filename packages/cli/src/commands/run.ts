import { loadConfig, NullSecApiClient, type NullSecConfig } from '@nsec/core';
import { decryptProjectKeyWithUserKey, decryptProjectSecrets } from '@nsec/crypto';
import { createCredentialStore, type KeyringStorage } from '@nsec/keyring';
import { runCommandWithSecrets } from '../runner.js';
import { getRequiredCredentials } from './auth-helper.js';

export interface ExecuteRunOptions {
  env?: string;
  configOverride?: Partial<NullSecConfig>;
  credentialStore?: KeyringStorage;
  serviceToken?: string;
  signingKeys?: { privateKey: string; publicKey: string };
  encryptionPrivateKey?: string;
  command: string[];
}

export async function executeRun(options: ExecuteRunOptions): Promise<number> {
  const config = await loadConfig(process.cwd(), options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'development';

  let decryptedSecrets: Record<string, string> = {};

  const serviceToken = options.serviceToken || process.env.NULLSEC_TOKEN || process.env.NSEC_TOKEN || process.env.ZVAULT_TOKEN;
  if (serviceToken) {
    const client = new NullSecApiClient({
      serverUrl: config.serverUrl,
      serviceToken
    });
    const secretsResponse = await client.fetchSecrets(config.project, environment);
    throw new Error('Service token direct secret resolution will be supported with server token exchange.');
  }

  // User credentials flow
  const storage = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  
  let creds;
  if (!options.encryptionPrivateKey) {
    creds = await getRequiredCredentials(config.project, storage, config.serverUrl);
  }

  const encPrivateKey = options.encryptionPrivateKey || creds?.privateKey!;
  const signPrivKey = options.signingKeys?.privateKey || creds?.token || encPrivateKey;
  const signPubKey = options.signingKeys?.publicKey || creds?.publicKey || '';

  const client = new NullSecApiClient({
    serverUrl: config.serverUrl,
    signingKeys: { privateKey: signPrivKey, publicKey: signPubKey }
  });

  const secretsResponse = await client.fetchSecrets(config.project, environment);

  // Decrypt Project Key with User Private Key
  const projectKey = decryptProjectKeyWithUserKey(secretsResponse.encryptedProjectKey, encPrivateKey);

  // Decrypt Secrets Payload with Project Key
  decryptedSecrets = decryptProjectSecrets(secretsResponse.secretsPayload, projectKey);

  // Launch target child process with secrets injected in memory
  return runCommandWithSecrets(options.command, decryptedSecrets);
}
