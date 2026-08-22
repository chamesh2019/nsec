export interface KeyPairPem {
  publicKey: string;
  privateKey: string;
}

export interface UserKeyPair {
  signing: KeyPairPem;
  encryption: KeyPairPem;
}

export interface EncryptedSecretsPayload {
  ciphertext: string; // Base64 encoded AES-GCM ciphertext
  iv: string;         // Base64 encoded 12-byte IV (96-bit)
  tag: string;        // Base64 encoded 16-byte authentication tag
  version: number;
}

export interface EncryptedProjectKey {
  encryptedKey: string; // Base64 encoded RSA-OAEP ciphertext
  algorithm: 'RSA-OAEP-4096';
}

export interface SignedMessage<T = unknown> {
  payload: T;
  signature: string;
  publicKey: string;
  timestamp: number;
}
