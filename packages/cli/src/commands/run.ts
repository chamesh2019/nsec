import {
  loadConfig,
  NullSecApiClient,
  type NullSecConfig,
  type EncryptedSecretsPayloadDTO,
  type EncryptedProjectKeyDTO
} from '@nsec/core';
import { decryptProjectKeyWithUserKey, decryptProjectSecrets } from '@nsec/crypto';
import { createCredentialStore, type KeyringStorage } from '@nsec/keyring';
import { runCommandWithSecrets } from '../runner.js';
import { getRequiredCredentials } from './auth-helper.js';
import { SecretsCache, isNetworkError } from '../cache.js';

export interface ExecuteRunOptions {
  env?: string;
  configOverride?: Partial<NullSecConfig>;
  credentialStore?: KeyringStorage;
  serviceToken?: string;
  signingKeys?: { privateKey: string; publicKey: string };
  encryptionPrivateKey?: string;
  cacheStore?: SecretsCache;
  offline?: boolean;
  noCache?: boolean;
  command: string[];
}

export async function executeRun(options: ExecuteRunOptions): Promise<number> {
  const config = await loadConfig(process.cwd(), options.configOverride);
  const environment = options.env || config.defaultEnvironment || 'development';
  const cache = options.cacheStore || new SecretsCache();

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

  let secretsPayload: EncryptedSecretsPayloadDTO;
  let encryptedProjectKey: EncryptedProjectKeyDTO;

  if (options.offline) {
    const cached = await cache.get(config.serverUrl, config.project, environment);
    if (!cached) {
      throw new Error(`Offline mode error: No cached secrets found for project "${config.project}" in environment "${environment}". Run online first to populate the cache.`);
    }
    console.error(`\x1b[36mℹ Running in offline mode using cached secrets (v${cached.version}, cached ${cached.cachedAt})\x1b[0m`);
    secretsPayload = cached.secretsPayload;
    encryptedProjectKey = cached.encryptedProjectKey;
  } else {
    const client = new NullSecApiClient({
      serverUrl: config.serverUrl,
      signingKeys: { privateKey: signPrivKey, publicKey: signPubKey }
    });

    try {
      const secretsResponse = await client.fetchSecrets(config.project, environment);
      secretsPayload = secretsResponse.secretsPayload;
      encryptedProjectKey = secretsResponse.encryptedProjectKey;

      if (!options.noCache) {
        await cache.set(config.serverUrl, config.project, environment, {
          projectId: config.project,
          environment,
          serverUrl: config.serverUrl,
          secretsPayload: secretsResponse.secretsPayload,
          encryptedProjectKey: secretsResponse.encryptedProjectKey,
          version: secretsResponse.version,
          updatedAt: secretsResponse.updatedAt
        });
      }
    } catch (err: unknown) {
      if (isNetworkError(err) && !options.noCache) {
        const cached = await cache.get(config.serverUrl, config.project, environment);
        if (cached) {
          console.error(
            `\x1b[33m⚠️  Offline: Server unreachable (${config.serverUrl}). Using cached secrets (v${cached.version}, cached ${cached.cachedAt})\x1b[0m`
          );
          secretsPayload = cached.secretsPayload;
          encryptedProjectKey = cached.encryptedProjectKey;
        } else {
          throw new Error(
            `Server unreachable (${config.serverUrl}) and no cached secrets found for project "${config.project}" (${environment}). Connect to the network and run again to fetch secrets.`
          );
        }
      } else {
        throw err;
      }
    }
  }

  // Decrypt Project Key with User Private Key
  const projectKey = decryptProjectKeyWithUserKey(encryptedProjectKey, encPrivateKey);

  // Decrypt Secrets Payload with Project Key
  decryptedSecrets = decryptProjectSecrets(secretsPayload, projectKey);

  // Launch target child process with secrets injected in memory
  return runCommandWithSecrets(options.command, decryptedSecrets);
}
