import type { KeyringManagerOptions, KeyringStorage } from './types.js';
import { MemoryStorageProvider } from './providers/memory.js';
import { FileStorageProvider } from './providers/file.js';
import { OSKeyringProvider } from './providers/os.js';
import { KeyringUnavailableError } from './errors.js';

export async function createCredentialStore(options: KeyringManagerOptions = {}): Promise<KeyringStorage> {
  const mode = options.mode || 'keyring';

  if (mode === 'memory') {
    return new MemoryStorageProvider();
  }

  if (mode === 'file') {
    return new FileStorageProvider(options.storagePath);
  }

  if (mode === 'keyring') {
    const osProvider = new OSKeyringProvider(options.serviceName);
    const available = await osProvider.isAvailable();
    if (!available) {
      throw new KeyringUnavailableError();
    }
    return osProvider;
  }

  throw new Error(`Unknown storage mode: ${mode}`);
}
