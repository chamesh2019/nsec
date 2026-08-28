import crypto from 'node:crypto';
import type { UserDTO } from '@nsec/core';

export interface StoredSession {
  token: string;
  user: UserDTO;
  createdAt: number;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly usedNonces = new Map<string, number>(); // nonce -> timestamp

  createSession(user: UserDTO, ttlMs = 2 * 60 * 60 * 1000): StoredSession {
    this.cleanExpired();
    const token = `ns_sess_${crypto.randomBytes(32).toString('hex')}`;
    const now = Date.now();
    const session: StoredSession = {
      token,
      user,
      createdAt: now,
      expiresAt: now + ttlMs
    };
    this.sessions.set(token, session);
    return session;
  }

  getSession(token: string): StoredSession | null {
    this.cleanExpired();
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  deleteSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  isNonceUsed(nonce: string): boolean {
    this.cleanExpired();
    return this.usedNonces.has(nonce);
  }

  markNonceUsed(nonce: string): void {
    this.usedNonces.set(nonce, Date.now());
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [token, s] of this.sessions.entries()) {
      if (s.expiresAt < now) {
        this.sessions.delete(token);
      }
    }
    // Clean nonces older than 2 minutes
    for (const [nonce, ts] of this.usedNonces.entries()) {
      if (now - ts > 120000) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}

export const globalSessionStore = new SessionStore();

export function extractSessionToken(headers: Record<string, string | string[] | undefined>): string | null {
  // 1. Check Cookie header
  const cookieHeader = Array.isArray(headers['cookie']) ? headers['cookie'].join(';') : headers['cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)nsec_session=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // 2. Check Authorization Bearer header
  const authHeader = Array.isArray(headers['authorization']) ? headers['authorization'][0] : headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ns_sess_')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}
