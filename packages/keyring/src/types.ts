export type StorageMode = 'keyring' | 'file' | 'memory';

export interface KeyringCredentials {
  keyId: string;
  privateKey: string;
  publicKey?: string;
  serverUrl?: string;
  token?: string;
  createdAt?: string;
}

export interface KeyringStorage {
  readonly name: StorageMode;
  saveCredentials(account: string, credentials: KeyringCredentials): Promise<void>;
  getCredentials(account: string): Promise<KeyringCredentials | null>;
  deleteCredentials(account: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}

export interface KeyringManagerOptions {
  mode?: StorageMode;
  serviceName?: string;
  storagePath?: string;
}
