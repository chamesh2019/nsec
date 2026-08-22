import crypto from 'node:crypto';
import type { EncryptedSecretsPayload } from './types.js';
import { DecryptionError, InvalidKeyError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const KEY_LENGTH = 32; // 256 bits

export function generateProjectKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

function parseAndValidateKey(keyBase64: string): Buffer {
  if (!keyBase64 || typeof keyBase64 !== 'string') {
    throw new InvalidKeyError('Key must be a non-empty base64 string.');
  }
  const keyBuffer = Buffer.from(keyBase64, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new InvalidKeyError(`Key must be exactly ${KEY_LENGTH} bytes (256-bit), got ${keyBuffer.length} bytes.`);
  }
  return keyBuffer;
}

export function encryptProjectSecrets(
  secrets: Record<string, string>,
  projectKey: string
): EncryptedSecretsPayload {
  const keyBuffer = parseAndValidateKey(projectKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const plaintext = JSON.stringify(secrets);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    version: 1
  };
}

export function decryptProjectSecrets(
  payload: EncryptedSecretsPayload,
  projectKey: string
): Record<string, string> {
  const keyBuffer = parseAndValidateKey(projectKey);

  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag) {
    throw new DecryptionError('Incomplete encrypted payload: ciphertext, iv, and tag are required.');
  }

  try {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
  } catch (err: unknown) {
    if (err instanceof DecryptionError) throw err;
    throw new DecryptionError((err as Error)?.message || 'Authentication tag validation failed.');
  }
}
