import type {
  DatabaseAdapter,
  StoredSecretsRecord,
  StoredServiceTokenRecord,
  StoredInviteTokenRecord
} from './types.js';
import type { UserDTO, ProjectDTO, ProjectMemberDTO, ServerUserRole } from '@nsec/core';

// Cloudflare D1 Database minimal interface
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta: Record<string, unknown>;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export class D1DatabaseAdapter implements DatabaseAdapter {
  private readonly db: D1Database;

  constructor(d1: D1Database) {
    this.db = d1;
  }

  async saveUser(user: UserDTO): Promise<void> {
    const cleanSigningKey = user.publicKeys.signingKey.replace(/\r\n/g, '\n').trim();
    const cleanEncKey = user.publicKeys.encryptionKey.replace(/\r\n/g, '\n').trim();
    const role = user.role || 'member';

    const existing = await this.getUserByEmail(user.email);
    if (existing) {
      await this.db
        .prepare(
          `UPDATE users SET
             role = ?,
             signing_key = ?,
             encryption_key = ?
           WHERE LOWER(email) = LOWER(?)`
        )
        .bind(role, cleanSigningKey, cleanEncKey, user.email)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO users (id, email, role, signing_key, encryption_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user.id,
          user.email,
          role,
          cleanSigningKey,
          cleanEncKey,
          user.createdAt
        )
        .run();
    }
  }

  async getUserById(id: string): Promise<UserDTO | null> {
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(id)
      .first<any>();

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      role: row.role || 'member',
      publicKeys: {
        signingKey: row.signing_key,
        encryptionKey: row.encryption_key
      },
      createdAt: row.created_at
    };
  }

  async getUserByEmail(email: string): Promise<UserDTO | null> {
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`)
      .bind(email)
      .first<any>();

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      role: row.role || 'member',
      publicKeys: {
        signingKey: row.signing_key,
        encryptionKey: row.encryption_key
      },
      createdAt: row.created_at
    };
  }

  async getUserBySigningKey(signingKeyPem: string): Promise<UserDTO | null> {
    const cleanKey = signingKeyPem.replace(/\r\n/g, '\n').trim();
    const row = await this.db
      .prepare(`SELECT * FROM users WHERE trim(replace(signing_key, char(13), '')) = ?`)
      .bind(cleanKey)
      .first<any>();

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      role: row.role || 'member',
      publicKeys: {
        signingKey: row.signing_key,
        encryptionKey: row.encryption_key
      },
      createdAt: row.created_at
    };
  }

  async countUsers(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) as count FROM users`)
      .first<{ count: number }>();
    return row ? row.count : 0;
  }

  async listUsers(): Promise<UserDTO[]> {
    const res = await this.db
      .prepare(`SELECT * FROM users ORDER BY created_at ASC`)
      .all<any>();

    return (res.results || []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role || 'member',
      publicKeys: {
        signingKey: row.signing_key,
        encryptionKey: row.encryption_key
      },
      createdAt: row.created_at
    }));
  }

  async updateUserRole(userId: string, role: ServerUserRole): Promise<void> {
    await this.db
      .prepare(`UPDATE users SET role = ? WHERE id = ?`)
      .bind(role, userId)
      .run();
  }

  async saveInviteToken(record: StoredInviteTokenRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO invite_tokens (id, email, token_hash, role, invited_by, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.email,
        record.tokenHash,
        record.role,
        record.invitedBy,
        record.expiresAt || null,
        record.createdAt
      )
      .run();
  }

  async getInviteTokenByHash(tokenHash: string): Promise<StoredInviteTokenRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM invite_tokens WHERE token_hash = ?`)
      .bind(tokenHash)
      .first<any>();

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      tokenHash: row.token_hash,
      role: row.role || 'member',
      invitedBy: row.invited_by,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at
    };
  }

  async listInviteTokens(): Promise<StoredInviteTokenRecord[]> {
    const res = await this.db
      .prepare(`SELECT * FROM invite_tokens ORDER BY created_at DESC`)
      .all<any>();

    return (res.results || []).map((row) => ({
      id: row.id,
      email: row.email,
      tokenHash: row.token_hash,
      role: row.role || 'member',
      invitedBy: row.invited_by,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at
    }));
  }

  async deleteInviteToken(tokenId: string): Promise<boolean> {
    const res = await this.db
      .prepare(`DELETE FROM invite_tokens WHERE id = ?`)
      .bind(tokenId)
      .run();
    return (res.meta?.changes as number) > 0;
  }


  async saveProject(project: ProjectDTO): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO projects (id, name, environments_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           environments_json = excluded.environments_json,
           updated_at = excluded.updated_at`
      )
      .bind(
        project.id,
        project.name,
        JSON.stringify(project.environments),
        project.createdAt,
        project.updatedAt
      )
      .run();

    // Save project creator / members
    if (project.members && project.members.length > 0) {
      for (const m of project.members) {
        await this.addProjectMember(project.id, m);
      }
    }
  }

  async getProject(idOrName: string): Promise<ProjectDTO | null> {
    const row = await this.db
      .prepare(`SELECT * FROM projects WHERE id = ? OR name = ?`)
      .bind(idOrName, idOrName)
      .first<any>();

    if (!row) return null;

    const membersResult = await this.db
      .prepare(`SELECT * FROM project_members WHERE project_id = ?`)
      .bind(row.id)
      .all<any>();

    const members: ProjectMemberDTO[] = (membersResult.results || []).map((m: any) => ({
      userId: m.user_id,
      email: m.email,
      role: m.role,
      environments: JSON.parse(m.environments_json || '[]'),
      joinedAt: m.joined_at
    }));

    return {
      id: row.id,
      name: row.name,
      environments: JSON.parse(row.environments_json || '[]'),
      members,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getProjectsForUser(userId: string): Promise<ProjectDTO[]> {
    const memberRows = await this.db
      .prepare(`SELECT DISTINCT project_id FROM project_members WHERE user_id = ?`)
      .bind(userId)
      .all<{ project_id: string }>();

    const list: ProjectDTO[] = [];
    for (const r of memberRows.results || []) {
      const p = await this.getProject(r.project_id);
      if (p) list.push(p);
    }
    return list;
  }

  async addProjectMember(projectId: string, member: ProjectMemberDTO): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO project_members (project_id, user_id, email, role, environments_json, joined_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, user_id) DO UPDATE SET
           role = excluded.role,
           environments_json = excluded.environments_json`
      )
      .bind(
        projectId,
        member.userId,
        member.email,
        member.role,
        JSON.stringify(member.environments),
        member.joinedAt
      )
      .run();
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const res = await this.db
      .prepare(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`)
      .bind(projectId, userId)
      .run();
    return (res.meta?.changes as number) > 0;
  }

  async saveSecrets(record: StoredSecretsRecord): Promise<void> {
    // 1. Save Secrets Payload
    await this.db
      .prepare(
        `INSERT INTO project_secrets (project_id, environment, ciphertext, iv, tag, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, environment) DO UPDATE SET
           ciphertext = excluded.ciphertext,
           iv = excluded.iv,
           tag = excluded.tag,
           version = excluded.version,
           updated_at = excluded.updated_at`
      )
      .bind(
        record.projectId,
        record.environment,
        record.secretsPayload.ciphertext,
        record.secretsPayload.iv,
        record.secretsPayload.tag,
        record.version,
        record.updatedAt
      )
      .run();

    // 2. Save individual encrypted project keys for members
    for (const [userId, keyObj] of Object.entries(record.projectKeys)) {
      await this.db
        .prepare(
          `INSERT INTO project_keys (project_id, environment, user_id, encrypted_key, algorithm, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, environment, user_id) DO UPDATE SET
             encrypted_key = excluded.encrypted_key,
             algorithm = excluded.algorithm,
             updated_at = excluded.updated_at`
        )
        .bind(
          record.projectId,
          record.environment,
          userId,
          keyObj.encryptedKey,
          keyObj.algorithm,
          record.updatedAt
        )
        .run();
    }
  }

  async getSecrets(projectId: string, environment: string): Promise<StoredSecretsRecord | null> {
    const secRow = await this.db
      .prepare(`SELECT * FROM project_secrets WHERE project_id = ? AND environment = ?`)
      .bind(projectId, environment)
      .first<any>();

    if (!secRow) return null;

    const keyRows = await this.db
      .prepare(`SELECT * FROM project_keys WHERE project_id = ? AND environment = ?`)
      .bind(projectId, environment)
      .all<any>();

    const projectKeys: Record<string, { encryptedKey: string; algorithm: 'RSA-OAEP-4096' }> = {};
    for (const k of keyRows.results || []) {
      projectKeys[k.user_id] = {
        encryptedKey: k.encrypted_key,
        algorithm: k.algorithm || 'RSA-OAEP-4096'
      };
    }

    return {
      projectId: secRow.project_id,
      environment: secRow.environment,
      secretsPayload: {
        ciphertext: secRow.ciphertext,
        iv: secRow.iv,
        tag: secRow.tag,
        version: secRow.version
      },
      projectKeys,
      version: secRow.version,
      updatedAt: secRow.updated_at
    };
  }

  async saveServiceToken(tokenRecord: StoredServiceTokenRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO service_tokens (id, project_id, environment, name, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tokenRecord.id,
        tokenRecord.projectId,
        tokenRecord.environment,
        tokenRecord.name,
        tokenRecord.tokenHash,
        tokenRecord.expiresAt || null,
        tokenRecord.createdAt
      )
      .run();
  }

  async getServiceTokenByHash(tokenHash: string): Promise<StoredServiceTokenRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM service_tokens WHERE token_hash = ?`)
      .bind(tokenHash)
      .first<any>();

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
    const res = await this.db
      .prepare(`DELETE FROM service_tokens WHERE project_id = ? AND id = ?`)
      .bind(projectId, tokenId)
      .run();
    return (res.meta?.changes as number) > 0;
  }
}
