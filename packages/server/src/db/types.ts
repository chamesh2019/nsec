import type {
  UserDTO,
  ProjectDTO,
  ProjectMemberDTO,
  ServiceTokenDTO,
  EncryptedSecretsPayloadDTO,
  EncryptedProjectKeyDTO
} from '@chamesh2020/core';

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

export interface DatabaseAdapter {
  // Users
  saveUser(user: UserDTO): Promise<void>;
  getUserById(id: string): Promise<UserDTO | null>;
  getUserByEmail(email: string): Promise<UserDTO | null>;
  getUserBySigningKey(signingKeyPem: string): Promise<UserDTO | null>;

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
