import { loadConfig, ZVaultApiClient, type ZVaultConfig } from '@chamesh2020/core';
import { decryptProjectKeyWithUserKey, decryptProjectSecrets } from '@chamesh2020/crypto';
import { createCredentialStore, type KeyringStorage } from '@chamesh2020/keyring';
import { runCommandWithSecrets } from '../runner.js';

export interface ExecuteRunOptions {
  env?: string;
  configOverride?: Partial<ZVaultConfig>;
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

  const serviceToken = options.serviceToken || process.env.ZVAULT_TOKEN;
  if (serviceToken) {
    const client = new ZVaultApiClient({
      serverUrl: config.serverUrl,
      serviceToken
    });
    const secretsResponse = await client.fetchSecrets(config.project, environment);
    throw new Error('Service token direct secret resolution will be supported with server token exchange.');
  }

  // User credentials flow
  const storage = options.credentialStore || (await createCredentialStore({ mode: config.storage }));
  const creds = await storage.getCredentials(config.project);

  if (!creds && !options.encryptionPrivateKey) {
    throw new Error(
      `No credentials found for project "${config.project}". Please run "zvault init" or "zvault login" first.`
    );
  }

  const encPrivateKey = options.encryptionPrivateKey || creds?.privateKey!;
  const signPrivKey = options.signingKeys?.privateKey || creds?.token || encPrivateKey;
  const signPubKey = options.signingKeys?.publicKey || creds?.publicKey || '';

  const client = new ZVaultApiClient({
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
