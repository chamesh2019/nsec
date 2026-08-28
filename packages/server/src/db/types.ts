import type {
  UserDTO,
  ProjectDTO,
  ProjectMemberDTO,
  ServiceTokenDTO,
  InviteTokenDTO,
  EncryptedSecretsPayloadDTO,
  EncryptedProjectKeyDTO,
  ServerUserRole
} from '@nsec/core';

export interface StoredSecretsRecord {
  projectId: string;
  environment: string;
  secretsPayload: EncryptedSecretsPayloadDTO;
  projectKeys: Record<string, EncryptedProjectKeyDTO>; // userId -> encryptedKey
  version: number;
  updatedAt: string;
}

export interface StoredServiceTokenRecord extends ServiceTokenDTO {
  tokenHash: string;
}

export interface StoredInviteTokenRecord extends InviteTokenDTO {
  tokenHash: string;
}

export interface DatabaseAdapter {
  // Users
  saveUser(user: UserDTO): Promise<void>;
  getUserById(id: string): Promise<UserDTO | null>;
  getUserByEmail(email: string): Promise<UserDTO | null>;
  getUserBySigningKey(signingKeyPem: string): Promise<UserDTO | null>;
  listUsers(): Promise<UserDTO[]>;
  countUsers(): Promise<number>;
  updateUserRole(userId: string, role: ServerUserRole): Promise<void>;

  // Invites
  saveInviteToken(record: StoredInviteTokenRecord): Promise<void>;
  getInviteTokenByHash(tokenHash: string): Promise<StoredInviteTokenRecord | null>;
  listInviteTokens(): Promise<StoredInviteTokenRecord[]>;
  deleteInviteToken(tokenId: string): Promise<boolean>;

  // Projects
  saveProject(project: ProjectDTO): Promise<void>;
  getProject(id: string): Promise<ProjectDTO | null>;
  getProjectsForUser(userId: string): Promise<ProjectDTO[]>;
  addProjectMember(projectId: string, member: ProjectMemberDTO): Promise<void>;
  removeProjectMember(projectId: string, userId: string): Promise<boolean>;

  // Secrets
  saveSecrets(record: StoredSecretsRecord): Promise<void>;
  getSecrets(projectId: string, environment: string): Promise<StoredSecretsRecord | null>;

  // Service Tokens
  saveServiceToken(tokenRecord: StoredServiceTokenRecord): Promise<void>;
  getServiceTokenByHash(tokenHash: string): Promise<StoredServiceTokenRecord | null>;
  deleteServiceToken(projectId: string, tokenId: string): Promise<boolean>;
}

