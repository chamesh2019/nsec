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

function normalizePem(pem: string): string {
  return pem.replace(/\r\n/g, '\n').trim();
}

export function signPayload<T = unknown>(
  payload: T,
  privateKeyPem: string,
  publicKeyPem: string
): SignedMessage<T> {
  if (!privateKeyPem || !publicKeyPem) {
    throw new InvalidKeyError('Both private and public keys are required for signing.');
  }

  const normalizedPriv = normalizePem(privateKeyPem);
  const normalizedPub = normalizePem(publicKeyPem);

  const timestamp = Date.now();
  const canonicalData = canonicalizeJson({ payload, timestamp });
  const dataBuffer = Buffer.from(canonicalData, 'utf-8');

  let signature: string;
  try {
    const keyObj = crypto.createPrivateKey(normalizedPriv);
    signature = crypto.sign(null, dataBuffer, keyObj).toString('base64');
  } catch {
    signature = crypto.sign(null, dataBuffer, normalizedPriv).toString('base64');
  }

  return {
    payload,
    signature,
    publicKey: normalizedPub,
    timestamp
  };
}

export function verifySignature<T = unknown>(signedMessage: SignedMessage<T>): boolean {
  if (!signedMessage || !signedMessage.signature || !signedMessage.publicKey) {
    return false;
  }

  try {
    const normalizedPub = normalizePem(signedMessage.publicKey);
    const canonicalData = canonicalizeJson({
      payload: signedMessage.payload,
      timestamp: signedMessage.timestamp
    });
    const dataBuffer = Buffer.from(canonicalData, 'utf-8');
    const signatureBuffer = Buffer.from(signedMessage.signature, 'base64');

    try {
      const keyObj = crypto.createPublicKey(normalizedPub);
      if (crypto.verify(null, dataBuffer, keyObj, signatureBuffer)) {
        return true;
      }
    } catch {}

    try {
      if (crypto.verify(null, dataBuffer, normalizedPub, signatureBuffer)) {
        return true;
      }
    } catch {}

    try {
      if (crypto.verify(undefined, dataBuffer, normalizedPub, signatureBuffer)) {
        return true;
      }
    } catch {}

    return false;
  } catch {
    return false;
  }
}
