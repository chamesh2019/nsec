import crypto from 'node:crypto';
import { verifySignature } from '@zvault/crypto';
import type { DatabaseAdapter, StoredServiceTokenRecord } from '../db/types.js';
import type { UserDTO } from '@zvault/core';

const MAX_TIMESTAMP_AGE_MS = 60_000; // 60 seconds

export interface AuthResult {
  authenticated: boolean;
  user?: UserDTO;
  serviceToken?: StoredServiceTokenRecord;
  error?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function verifyAuthHeaders(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
  db: DatabaseAdapter
): Promise<AuthResult> {
  const getHeader = (name: string): string | undefined => {
    const val = headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  // 1. Check for Service Token (Bearer Token)
  const authHeader = getHeader('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const tokenHash = hashToken(token);
    const tokenRecord = await db.getServiceTokenByHash(tokenHash);

    if (!tokenRecord) {
      return { authenticated: false, error: 'Invalid or revoked service token' };
    }
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return { authenticated: false, error: 'Service token has expired' };
    }
    return { authenticated: true, serviceToken: tokenRecord };
  }

  // 2. Check for Ed25519 Request Signature
  const signature = getHeader('x-zvault-signature');
  const publicKeyBase64 = getHeader('x-zvault-public-key');
  const timestampStr = getHeader('x-zvault-timestamp');

  if (!signature || !publicKeyBase64 || !timestampStr) {
    return { authenticated: false, error: 'Missing authentication headers' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_TIMESTAMP_AGE_MS) {
    return { authenticated: false, error: 'Timestamp expired or invalid (possible replay attack)' };
  }

  let publicKeyPem: string;
  try {
    publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');
  } catch {
    return { authenticated: false, error: 'Malformed public key header' };
  }

  const isValid = verifySignature({
    payload: body || {},
    signature,
    publicKey: publicKeyPem,
    timestamp
  });

  if (!isValid) {
    return { authenticated: false, error: 'Invalid cryptographic signature' };
  }

  const user = await db.getUserBySigningKey(publicKeyPem);
  if (!user) {
    return { authenticated: false, error: 'Public key not registered with any user' };
  }

  return { authenticated: true, user };
}
