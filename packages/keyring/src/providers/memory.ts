import type { KeyringCredentials, KeyringStorage, StorageMode } from '../types.js';

export class MemoryStorageProvider implements KeyringStorage {
  public readonly name: StorageMode = 'memory';
  private readonly store = new Map<string, KeyringCredentials>();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async saveCredentials(account: string, credentials: KeyringCredentials): Promise<void> {
    this.store.set(account, { ...credentials });
  }

  async getCredentials(account: string): Promise<KeyringCredentials | null> {
    const creds = this.store.get(account);
    return creds ? { ...creds } : null;
  }

  async deleteCredentials(account: string): Promise<boolean> {
    return this.store.delete(account);
  }

  async listAccounts(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  clear(): void {
    this.store.clear();
  }
}
