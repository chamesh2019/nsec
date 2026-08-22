import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { UserKeyPair, EncryptedProjectKey, KeyPairPem } from './types.js';
import { DecryptionError, InvalidKeyError } from './errors.js';

const generateKeyPairAsync = promisify(crypto.generateKeyPair);

export async function generateRSAKeyPair(modulusLength = 4096): Promise<KeyPairPem> {
  const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return { publicKey, privateKey };
}

export async function generateEd25519KeyPair(): Promise<KeyPairPem> {
  const { publicKey, privateKey } = await generateKeyPairAsync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return { publicKey, privateKey };
}

export async function generateUserKeyPair(): Promise<UserKeyPair> {
  const [signing, encryption] = await Promise.all([
    generateEd25519KeyPair(),
    generateRSAKeyPair(4096)
  ]);

  return { signing, encryption };
}

export function encryptProjectKeyForUser(
  projectKey: string,
  userPublicKeyPem: string
): EncryptedProjectKey {
  if (!projectKey) {
    throw new InvalidKeyError('Project key cannot be empty.');
  }
  if (!userPublicKeyPem) {
    throw new InvalidKeyError('User public key PEM is required.');
  }

  try {
    const buffer = Buffer.from(projectKey, 'utf-8');
    const encrypted = crypto.publicEncrypt(
      {
        key: userPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );

    return {
      encryptedKey: encrypted.toString('base64'),
      algorithm: 'RSA-OAEP-4096'
    };
  } catch (err: unknown) {
    throw new InvalidKeyError(`Encryption failed: ${(err as Error)?.message}`);
  }
}

export function decryptProjectKeyWithUserKey(
  encryptedProjectKey: EncryptedProjectKey | string,
  userPrivateKeyPem: string
): string {
  const keyBase64 = typeof encryptedProjectKey === 'string'
    ? encryptedProjectKey
    : encryptedProjectKey.encryptedKey;

  if (!keyBase64 || !userPrivateKeyPem) {
    throw new InvalidKeyError('Both encrypted key and user private key are required.');
  }

  try {
    const encryptedBuffer = Buffer.from(keyBase64, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: userPrivateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    );

    return decrypted.toString('utf-8');
  } catch (err: unknown) {
    throw new DecryptionError(`Failed to decrypt project key: ${(err as Error)?.message}`);
  }
}
