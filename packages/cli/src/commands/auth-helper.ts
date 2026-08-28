import type { KeyringStorage, KeyringCredentials } from '@nsec/keyring';
import { serverAccountKey } from './url-helpers.js';

export async function getRequiredCredentials(
  project: string,
  store: KeyringStorage,
  serverUrl?: string
): Promise<KeyringCredentials> {
  let creds: KeyringCredentials | null = null;

  // 1. Try server-scoped credentials if serverUrl is provided
  if (serverUrl) {
    creds = await store.getCredentials(serverAccountKey(serverUrl));
  }

  // 2. Try legacy project-specific credentials
  if (!creds && project) {
    creds = await store.getCredentials(project);
  }

  // 3. Fall back to global default identity on this machine
  if (!creds) {
    creds = await store.getCredentials('default');
  }

  // 4. If still missing, throw an actionable guide
  if (!creds) {
    const serverHint = serverUrl ? ` --server ${serverUrl}` : '';
    throw new Error(
      `No cryptographic keys found for server "${serverUrl || 'default'}" (project "${project}").\n\n` +
      `Generate your keys first by running:\n` +
      `  \x1b[36mnsec register <your-email>${serverHint}\x1b[0m\n` +
      `or initialize this project:\n` +
      `  \x1b[36mnsec init --email <your-email>${serverHint}\x1b[0m\n`
    );
  }

  return creds;
}

