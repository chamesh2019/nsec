// OS Keyring credential storage abstraction for @zvault/keyring
export const KEYRING_VERSION = '0.1.0';

export interface KeyringCredentials {
  keyId: string;
  privateKey: string;
  publicKey?: string;
  serverUrl?: string;
  token?: string;
}

export interface KeyringStorage {
  saveCredentials(service: string, account: string, credentials: KeyringCredentials): Promise<void>;
  getCredentials(service: string, account: string): Promise<KeyringCredentials | null>;
  deleteCredentials(service: string, account: string): Promise<boolean>;
}
