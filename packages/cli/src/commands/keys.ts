import crypto from 'node:crypto';
import { loadConfig, findConfigFile, NullSecApiClient } from '@nsec/core';
import { createCredentialStore, type StorageMode, type KeyringStorage } from '@nsec/keyring';
import { normalizeServerUrl, serverAccountKey, isServerAccountKey, serverUrlFromAccountKey } from './url-helpers.js';

export interface KeysCommandOptions {
  storage?: StorageMode;
  credentialStore?: KeyringStorage;
  serverUrl?: string;
  cwd?: string;
}

export interface ServerIdentityInfo {
  serverUrl: string;
  userEmail?: string;
  storage: string;
  signingKeyFingerprint?: string;
  encryptionKeyFingerprint?: string;
}

export interface WhoamiResult {
  project: string;
  serverUrl: string;
  storage: string;
  signingKeyFingerprint?: string;
  encryptionKeyFingerprint?: string;
  userEmail?: string;
  isMultiServer?: boolean;
  identities: ServerIdentityInfo[];
}

export function computeKeyFingerprint(keyPem: string): string {
  const clean = keyPem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const hash = crypto.createHash('sha256').update(clean).digest('hex');
  return hash.slice(0, 16).match(/.{1,4}/g)?.join(':') || hash.slice(0, 16);
}

export async function executeWhoami(options: KeysCommandOptions = {}): Promise<WhoamiResult> {
  const cwd = options.cwd || process.cwd();
  let project = '(none - outside project directory)';
  let serverUrl: string | undefined = options.serverUrl ? normalizeServerUrl(options.serverUrl) : undefined;
  let storage: StorageMode = options.storage || 'keyring';
  let inProject = false;

  const configFile = await findConfigFile(cwd);
  if (configFile) {
    try {
      const config = await loadConfig(cwd);
      project = config.project;
      serverUrl = options.serverUrl ? normalizeServerUrl(options.serverUrl) : normalizeServerUrl(config.serverUrl);
      storage = options.storage || config.storage || 'keyring';
      inProject = true;
    } catch {}
  }

  const store = options.credentialStore || (await createCredentialStore({ mode: storage }));

  // If in a project or explicit --server was specified, show single server identity
  if (inProject || serverUrl) {
    const activeServer = serverUrl || 'https://nsec.chames.dev';
    let creds = (await store.getCredentials(serverAccountKey(activeServer))) ||
                (await store.getCredentials(project)) ||
                (await store.getCredentials('default'));

    if (!creds) {
      throw new Error(
        `No cryptographic keys found for server "${activeServer}".\n` +
        `Run \x1b[36mnsec register <your-email> --server ${activeServer}\x1b[0m to generate keys.`
      );
    }

    const signingFp = creds.publicKey ? computeKeyFingerprint(creds.publicKey) : undefined;
    const encFp = creds.privateKey ? computeKeyFingerprint(creds.privateKey) : undefined;
    const identity: ServerIdentityInfo = {
      serverUrl: creds.serverUrl || activeServer,
      userEmail: creds.email || '(unregistered or offline)',
      storage,
      signingKeyFingerprint: signingFp,
      encryptionKeyFingerprint: encFp
    };

    return {
      project,
      serverUrl: identity.serverUrl,
      storage,
      signingKeyFingerprint: signingFp,
      encryptionKeyFingerprint: encFp,
      userEmail: identity.userEmail,
      isMultiServer: false,
      identities: [identity]
    };
  }

  // Outside project with no specific server specified: list all server identities
  const accounts = typeof store.listAccounts === 'function' ? await store.listAccounts() : ['default'];
  const serverAccounts = accounts.filter((a) => isServerAccountKey(a));
  const candidateAccounts = serverAccounts.length > 0 ? serverAccounts : (accounts.includes('default') ? ['default'] : accounts);

  const identities: ServerIdentityInfo[] = [];

  for (const acc of candidateAccounts) {
    const creds = await store.getCredentials(acc);
    if (!creds) continue;

    const accServer = creds.serverUrl || (isServerAccountKey(acc) ? serverUrlFromAccountKey(acc) : 'default');
    const signingFp = creds.publicKey ? computeKeyFingerprint(creds.publicKey) : undefined;
    const encFp = creds.privateKey ? computeKeyFingerprint(creds.privateKey) : undefined;

    identities.push({
      serverUrl: accServer,
      userEmail: creds.email || '(unregistered or offline)',
      storage,
      signingKeyFingerprint: signingFp,
      encryptionKeyFingerprint: encFp
    });
  }

  if (identities.length === 0) {
    throw new Error(
      `No cryptographic keys found on this machine.\n` +
      `Run \x1b[36mnsec register <your-email> --server https://nsec.chames.dev\x1b[0m to generate keys.`
    );
  }

  const primary = identities[0];
  return {
    project,
    serverUrl: primary.serverUrl,
    storage,
    signingKeyFingerprint: primary.signingKeyFingerprint,
    encryptionKeyFingerprint: primary.encryptionKeyFingerprint,
    userEmail: primary.userEmail,
    isMultiServer: true,
    identities
  };
}

export async function executeListKeys(options: KeysCommandOptions = {}): Promise<string[]> {
  let storage: StorageMode = options.storage || 'keyring';
  try {
    const config = await loadConfig(options.cwd || process.cwd());
    storage = options.storage || config.storage || 'keyring';
  } catch {}

  const store = options.credentialStore || (await createCredentialStore({ mode: storage }));
  if (typeof store.listAccounts !== 'function') {
    return ['default'];
  }

  const accounts = await store.listAccounts();
  const results: string[] = [];

  for (const acc of accounts) {
    if (isServerAccountKey(acc)) {
      const creds = await store.getCredentials(acc);
      const url = serverUrlFromAccountKey(acc);
      if (creds?.email) {
        results.push(`${url} (${creds.email})`);
      } else {
        results.push(url);
      }
    } else {
      results.push(acc);
    }
  }

  return results.length > 0 ? results : accounts;
}
