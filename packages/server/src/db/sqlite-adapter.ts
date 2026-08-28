import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

import type {
  DatabaseAdapter,
  StoredSecretsRecord,
  StoredServiceTokenRecord,
  StoredInviteTokenRecord
} from './types.js';
import type {
  UserDTO,
  ProjectDTO,
  ProjectMemberDTO,
  ServerUserRole
} from '@nsec/core';

export class SqliteDatabaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new (DatabaseSync as any)(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        signing_key TEXT NOT NULL,
        encryption_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        environments_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        environments_json TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_secrets (
        project_id TEXT NOT NULL,
        environment TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (project_id, environment),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_keys (
        project_id TEXT NOT NULL,
        environment TEXT NOT NULL,
        user_id TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'RSA-OAEP-4096',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (project_id, environment, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS service_tokens (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        environment TEXT NOT NULL,
        name TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invite_tokens (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        invited_by TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_service_tokens_hash ON service_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_invite_tokens_hash ON invite_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email);
    `);
  }

  // --- Users ---

  async saveUser(user: UserDTO): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, role, signing_key, encryption_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        signing_key = excluded.signing_key,
        encryption_key = excluded.encryption_key
    `);
    stmt.run(
      user.id,
      user.email,
      user.role || 'member',
      user.publicKeys.signingKey,
      user.publicKeys.encryptionKey,
      user.createdAt
    );
  }

  async getUserById(id: string): Promise<UserDTO | null> {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.mapUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<UserDTO | null> {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`);
    const row = stmt.get(email) as any;
    return row ? this.mapUser(row) : null;
  }

  async getUserBySigningKey(signingKeyPem: string): Promise<UserDTO | null> {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE signing_key = ?`);
    const row = stmt.get(signingKeyPem) as any;
    return row ? this.mapUser(row) : null;
  }

  async listUsers(): Promise<UserDTO[]> {
    const stmt = this.db.prepare(`SELECT * FROM users ORDER BY created_at ASC`);
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapUser(r));
  }

  async countUsers(): Promise<number> {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM users`);
    const row = stmt.get() as { count: number };
    return Number(row?.count || 0);
  }

  async updateUserRole(userId: string, role: ServerUserRole): Promise<void> {
    const stmt = this.db.prepare(`UPDATE users SET role = ? WHERE id = ?`);
    stmt.run(role, userId);
  }

  private mapUser(row: any): UserDTO {
    return {
      id: row.id,
      email: row.email,
      role: (row.role as ServerUserRole) || 'member',
      publicKeys: {
        signingKey: row.signing_key,
        encryptionKey: row.encryption_key
      },
      createdAt: row.created_at
    };
  }

  // --- Invite Tokens ---

  async saveInviteToken(record: StoredInviteTokenRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO invite_tokens (id, email, token_hash, role, invited_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.email,
      record.tokenHash,
      record.role || 'member',
      record.invitedBy,
      record.expiresAt || null,
      record.createdAt
    );
  }

  async getInviteTokenByHash(tokenHash: string): Promise<StoredInviteTokenRecord | null> {
    const stmt = this.db.prepare(`SELECT * FROM invite_tokens WHERE token_hash = ?`);
    const row = stmt.get(tokenHash) as any;
    return row ? this.mapInvite(row) : null;
  }

  async listInviteTokens(): Promise<StoredInviteTokenRecord[]> {
    const stmt = this.db.prepare(`SELECT * FROM invite_tokens ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapInvite(r));
  }

  async deleteInviteToken(tokenId: string): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM invite_tokens WHERE id = ?`);
    stmt.run(tokenId);
    return true;
  }

  private mapInvite(row: any): StoredInviteTokenRecord {
    return {
      id: row.id,
      email: row.email,
      tokenHash: row.token_hash,
      role: (row.role as ServerUserRole) || 'member',
      invitedBy: row.invited_by,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at
    };
  }

  // --- Projects ---

  async saveProject(project: ProjectDTO): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, environments_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        environments_json = excluded.environments_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      project.id,
      project.name,
      JSON.stringify(project.environments),
      project.createdAt,
      project.updatedAt
    );

    if (project.members && project.members.length > 0) {
      for (const m of project.members) {
        await this.addProjectMember(project.id, m);
      }
    }
  }

  async getProject(id: string): Promise<ProjectDTO | null> {
    const stmt = this.db.prepare(`SELECT * FROM projects WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    const membersStmt = this.db.prepare(`SELECT * FROM project_members WHERE project_id = ?`);
    const memberRows = membersStmt.all(id) as any[];

    return {
      id: row.id,
      name: row.name,
      environments: JSON.parse(row.environments_json),
      members: memberRows.map((m) => ({
        userId: m.user_id,
        email: m.email,
        role: m.role,
        environments: JSON.parse(m.environments_json),
        joinedAt: m.joined_at
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getProjectsForUser(userId: string): Promise<ProjectDTO[]> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.updated_at DESC
    `);
    const rows = stmt.all(userId) as any[];
    const results: ProjectDTO[] = [];
    for (const r of rows) {
      const proj = await this.getProject(r.id);
      if (proj) results.push(proj);
    }
    return results;
  }

  async addProjectMember(projectId: string, member: ProjectMemberDTO): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO project_members (project_id, user_id, email, role, environments_json, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        environments_json = excluded.environments_json
    `);
    stmt.run(
      projectId,
      member.userId,
      member.email,
      member.role,
      JSON.stringify(member.environments),
      member.joinedAt
    );
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`);
    stmt.run(projectId, userId);
    return true;
  }

  // --- Secrets ---

  async saveSecrets(record: StoredSecretsRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO project_secrets (project_id, environment, ciphertext, iv, tag, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, environment) DO UPDATE SET
        ciphertext = excluded.ciphertext,
        iv = excluded.iv,
        tag = excluded.tag,
        version = excluded.version,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.projectId,
      record.environment,
      record.secretsPayload.ciphertext,
      record.secretsPayload.iv,
      record.secretsPayload.tag,
      record.version,
      record.updatedAt
    );

    for (const [userId, encKey] of Object.entries(record.projectKeys)) {
      const keyStmt = this.db.prepare(`
        INSERT INTO project_keys (project_id, environment, user_id, encrypted_key, algorithm, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, environment, user_id) DO UPDATE SET
          encrypted_key = excluded.encrypted_key,
          algorithm = excluded.algorithm,
          updated_at = excluded.updated_at
      `);
      keyStmt.run(
        record.projectId,
        record.environment,
        userId,
        encKey.encryptedKey,
        encKey.algorithm,
        record.updatedAt
      );
    }
  }

  async getSecrets(projectId: string, environment: string): Promise<StoredSecretsRecord | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM project_secrets WHERE project_id = ? AND environment = ?
    `);
    const row = stmt.get(projectId, environment) as any;
    if (!row) return null;

    const keysStmt = this.db.prepare(`
      SELECT * FROM project_keys WHERE project_id = ? AND environment = ?
    `);
    const keyRows = keysStmt.all(projectId, environment) as any[];
    const projectKeys: Record<string, any> = {};
    for (const k of keyRows) {
      projectKeys[k.user_id] = {
        encryptedKey: k.encrypted_key,
        algorithm: k.algorithm
      };
    }

    return {
      projectId: row.project_id,
      environment: row.environment,
      secretsPayload: {
        ciphertext: row.ciphertext,
        iv: row.iv,
        tag: row.tag,
        version: row.version
      },
      projectKeys,
      version: row.version,
      updatedAt: row.updated_at
    };
  }

  // --- Service Tokens ---

  async saveServiceToken(tokenRecord: StoredServiceTokenRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO service_tokens (id, project_id, environment, name, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      tokenRecord.id,
      tokenRecord.projectId,
      tokenRecord.environment,
      tokenRecord.name,
      tokenRecord.tokenHash,
      tokenRecord.expiresAt || null,
      tokenRecord.createdAt
    );
  }

  async getServiceTokenByHash(tokenHash: string): Promise<StoredServiceTokenRecord | null> {
    const stmt = this.db.prepare(`SELECT * FROM service_tokens WHERE token_hash = ?`);
    const row = stmt.get(tokenHash) as any;
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      environment: row.environment,
      name: row.name,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at
    };
  }

  async deleteServiceToken(projectId: string, tokenId: string): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM service_tokens WHERE project_id = ? AND id = ?`);
    stmt.run(projectId, tokenId);
    return true;
  }
}
