export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class DecryptionError extends CryptoError {
  constructor(reason = 'Authentication tag mismatch or corrupted ciphertext') {
    super(`Decryption failed: ${reason}`);
    this.name = 'DecryptionError';
  }
}

export class SignatureVerificationError extends CryptoError {
  constructor(reason = 'Invalid signature') {
    super(`Signature verification failed: ${reason}`);
    this.name = 'SignatureVerificationError';
  }
}

export class InvalidKeyError extends CryptoError {
  constructor(reason: string) {
    super(`Invalid key format: ${reason}`);
    this.name = 'InvalidKeyError';
  }
}
