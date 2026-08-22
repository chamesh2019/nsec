import crypto from 'node:crypto';
import { loadConfig, findConfigFile, NullSecApiClient } from '@nsec/core';
import { createCredentialStore, type StorageMode } from '@nsec/keyring';

export interface KeysCommandOptions {
  storage?: StorageMode;
  serverUrl?: string;
  cwd?: string;
}

export function computeKeyFingerprint(keyPem: string): string {
  const clean = keyPem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const hash = crypto.createHash('sha256').update(clean).digest('hex');
  return hash.slice(0, 16).match(/.{1,4}/g)?.join(':') || hash.slice(0, 16);
}

export async function executeWhoami(options: KeysCommandOptions = {}): Promise<{
  project: string;
  serverUrl: string;
  storage: string;
  signingKeyFingerprint?: string;
  encryptionKeyFingerprint?: string;
  userEmail?: string;
}> {
  const cwd = options.cwd || process.cwd();
  let project = '(none - outside project directory)';
  let serverUrl: string | undefined;
  let storage: StorageMode = options.storage || 'keyring';

  const configFile = await findConfigFile(cwd);
  if (configFile) {
    try {
      const config = await loadConfig(cwd);
      project = config.project;
      serverUrl = options.serverUrl || config.serverUrl;
      storage = options.storage || config.storage || 'keyring';
    } catch {}
  }

  const store = await createCredentialStore({ mode: storage });
  let creds = (configFile ? await store.getCredentials(project) : null) || (await store.getCredentials('default'));

  if (!creds) {
    throw new Error(
      `No cryptographic keys found on this machine.\n` +
      `Run \x1b[36mnsec register <your-email> --server ${serverUrl || 'https://nsec.chames.dev'}\x1b[0m to generate keys.`
    );
  }

  serverUrl = serverUrl || creds.serverUrl || options.serverUrl || 'https://nsec.chames.dev';
  const signingFp = creds.publicKey ? computeKeyFingerprint(creds.publicKey) : undefined;
  const encFp = creds.privateKey ? computeKeyFingerprint(creds.privateKey) : undefined;
  let userEmail: string | undefined = creds.email;

  // Verify / lookup email against server if available
  if (!userEmail && creds.publicKey) {
    try {
      const client = new NullSecApiClient({
        serverUrl,
        signingKeys: { privateKey: creds.token || creds.privateKey, publicKey: creds.publicKey || '' }
      });
      const user = await client.getUser(creds.publicKey);
      userEmail = user.email;
    } catch {}
  }

  return {
    project,
    serverUrl,
    storage,
    signingKeyFingerprint: signingFp,
    encryptionKeyFingerprint: encFp,
    userEmail: userEmail || '(unregistered or offline)'
  };
}

export async function executeListKeys(options: KeysCommandOptions = {}): Promise<string[]> {
  let storage: StorageMode = options.storage || 'keyring';
  try {
    const config = await loadConfig(options.cwd || process.cwd());
    storage = options.storage || config.storage || 'keyring';
  } catch {}

  const store = await createCredentialStore({ mode: storage });
  if (typeof store.listAccounts === 'function') {
    return store.listAccounts();
  }
  return ['default'];
}
