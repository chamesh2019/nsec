import type {
  DatabaseAdapter,
  StoredSecretsRecord,
  StoredServiceTokenRecord,
  StoredInviteTokenRecord
} from './types.js';
import type { UserDTO, ProjectDTO, ProjectMemberDTO, ServerUserRole } from '@nsec/core';

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  private readonly users = new Map<string, UserDTO>();
  private readonly projects = new Map<string, ProjectDTO>();
  private readonly secrets = new Map<string, StoredSecretsRecord>(); // `${projectId}:${env}` -> record
  private readonly serviceTokens = new Map<string, StoredServiceTokenRecord>(); // tokenHash -> record
  private readonly inviteTokens = new Map<string, StoredInviteTokenRecord>(); // tokenHash -> record

  async saveUser(user: UserDTO): Promise<void> {
    this.users.set(user.id, {
      ...user,
      role: user.role || 'member'
    });
  }

  async getUserById(id: string): Promise<UserDTO | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async getUserByEmail(email: string): Promise<UserDTO | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return { ...u };
    }
    return null;
  }

  async getUserBySigningKey(signingKeyPem: string): Promise<UserDTO | null> {
    const cleanKey = signingKeyPem.trim();
    for (const u of this.users.values()) {
      if (u.publicKeys.signingKey.trim() === cleanKey) return { ...u };
    }
    return null;
  }

  async countUsers(): Promise<number> {
    return this.users.size;
  }

  async listUsers(): Promise<UserDTO[]> {
    return Array.from(this.users.values()).map((u) => ({ ...u }));
  }

  async updateUserRole(userId: string, role: ServerUserRole): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.role = role;
    }
  }

  async saveInviteToken(record: StoredInviteTokenRecord): Promise<void> {
    this.inviteTokens.set(record.tokenHash, { ...record });
  }

  async getInviteTokenByHash(tokenHash: string): Promise<StoredInviteTokenRecord | null> {
    const rec = this.inviteTokens.get(tokenHash);
    return rec ? { ...rec } : null;
  }

  async listInviteTokens(): Promise<StoredInviteTokenRecord[]> {
    return Array.from(this.inviteTokens.values()).map((r) => ({ ...r }));
  }

  async deleteInviteToken(tokenId: string): Promise<boolean> {
    for (const [hash, rec] of this.inviteTokens.entries()) {
      if (rec.id === tokenId) {
        return this.inviteTokens.delete(hash);
      }
    }
    return false;
  }

  async saveProject(project: ProjectDTO): Promise<void> {
    this.projects.set(project.id, { ...project });
  }

  async getProject(id: string): Promise<ProjectDTO | null> {
    const proj = this.projects.get(id);
    return proj ? { ...proj } : null;
  }

  async getProjectsForUser(userId: string): Promise<ProjectDTO[]> {
    const list: ProjectDTO[] = [];
    for (const p of this.projects.values()) {
      if (p.members.some((m) => m.userId === userId)) {
        list.push({ ...p });
      }
    }
    return list;
  }

  async addProjectMember(projectId: string, member: ProjectMemberDTO): Promise<void> {
    const p = this.projects.get(projectId);
    if (p) {
      const filtered = p.members.filter((m) => m.userId !== member.userId);
      filtered.push(member);
      p.members = filtered;
      p.updatedAt = new Date().toISOString();
    }
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const p = this.projects.get(projectId);
    if (!p) return false;
    const initialLen = p.members.length;
    p.members = p.members.filter((m) => m.userId !== userId);
    p.updatedAt = new Date().toISOString();
    return p.members.length < initialLen;
  }

  async saveSecrets(record: StoredSecretsRecord): Promise<void> {
    const key = `${record.projectId}:${record.environment}`;
    this.secrets.set(key, { ...record });
  }

  async getSecrets(projectId: string, environment: string): Promise<StoredSecretsRecord | null> {
    const key = `${projectId}:${environment}`;
    const record = this.secrets.get(key);
    return record ? { ...record } : null;
  }

  async saveServiceToken(tokenRecord: StoredServiceTokenRecord): Promise<void> {
    this.serviceTokens.set(tokenRecord.tokenHash, { ...tokenRecord });
  }

  async getServiceTokenByHash(tokenHash: string): Promise<StoredServiceTokenRecord | null> {
    const rec = this.serviceTokens.get(tokenHash);
    return rec ? { ...rec } : null;
  }

  async deleteServiceToken(projectId: string, tokenId: string): Promise<boolean> {
    for (const [hash, rec] of this.serviceTokens.entries()) {
      if (rec.projectId === projectId && rec.id === tokenId) {
        return this.serviceTokens.delete(hash);
      }
    }
    return false;
  }
}

