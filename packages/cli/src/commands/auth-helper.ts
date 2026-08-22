import type { KeyringStorage, StoredCredentials } from '@nsec/keyring';

export async function getRequiredCredentials(
  project: string,
  store: KeyringStorage,
  serverUrl?: string
): Promise<StoredCredentials> {
  // 1. Try project-specific credentials
  let creds = await store.getCredentials(project);

  // 2. Fall back to global default identity on this machine
  if (!creds) {
    creds = await store.getCredentials('default');
  }

  // 3. If still missing, throw an actionable guide
  if (!creds) {
    const serverHint = serverUrl ? ` --server ${serverUrl}` : '';
    throw new Error(
      `No cryptographic keys found for project "${project}".\n\n` +
      `Generate your keys first by running:\n` +
      `  \x1b[36mnsec register <your-email>${serverHint}\x1b[0m\n` +
      `or initialize this project:\n` +
      `  \x1b[36mnsec init --email <your-email>${serverHint}\x1b[0m\n`
    );
  }

  return creds;
}
