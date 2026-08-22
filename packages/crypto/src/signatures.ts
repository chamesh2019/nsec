import crypto from 'node:crypto';
import type { SignedMessage } from './types.js';
import { InvalidKeyError } from './errors.js';

export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`);
  return '{' + entries.join(',') + '}';
}

export function signPayload<T = unknown>(
  payload: T,
  privateKeyPem: string,
  publicKeyPem: string
): SignedMessage<T> {
  if (!privateKeyPem || !publicKeyPem) {
    throw new InvalidKeyError('Both private and public keys are required for signing.');
  }

  const timestamp = Date.now();
  const canonicalData = canonicalizeJson({ payload, timestamp });
  const dataBuffer = Buffer.from(canonicalData, 'utf-8');

  const signature = crypto.sign(null, dataBuffer, privateKeyPem).toString('base64');

  return {
    payload,
    signature,
    publicKey: publicKeyPem,
    timestamp
  };
}

export function verifySignature<T = unknown>(signedMessage: SignedMessage<T>): boolean {
  if (!signedMessage || !signedMessage.signature || !signedMessage.publicKey) {
    return false;
  }

  try {
    const canonicalData = canonicalizeJson({
      payload: signedMessage.payload,
      timestamp: signedMessage.timestamp
    });
    const dataBuffer = Buffer.from(canonicalData, 'utf-8');
    const signatureBuffer = Buffer.from(signedMessage.signature, 'base64');

    return crypto.verify(null, dataBuffer, signedMessage.publicKey, signatureBuffer);
  } catch {
    return false;
  }
}
