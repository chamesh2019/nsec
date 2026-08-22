import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { KeyringCredentials, KeyringStorage, StorageMode } from '../types.js';

export class FileStorageProvider implements KeyringStorage {
  public readonly name: StorageMode = 'file';
  private readonly filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(os.homedir(), '.zvault', 'credentials.json');
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private async readStore(): Promise<Record<string, KeyringCredentials>> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw err;
    }
  }

  private async writeStore(store: Record<string, KeyringCredentials>): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const tempFile = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const data = JSON.stringify(store, null, 2);

    await fs.writeFile(tempFile, data, { mode: 0o600, encoding: 'utf-8' });
    if (process.platform !== 'win32') {
      await fs.chmod(tempFile, 0o600);
    }
    await fs.rename(tempFile, this.filePath);
  }

  async saveCredentials(account: string, credentials: KeyringCredentials): Promise<void> {
    const store = await this.readStore();
    store[account] = { ...credentials };
    await this.writeStore(store);
  }

  async getCredentials(account: string): Promise<KeyringCredentials | null> {
    const store = await this.readStore();
    return store[account] ? { ...store[account] } : null;
  }

  async deleteCredentials(account: string): Promise<boolean> {
    const store = await this.readStore();
    if (!(account in store)) {
      return false;
    }
    delete store[account];
    await this.writeStore(store);
    return true;
  }
}
