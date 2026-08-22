import { signPayload } from '@chamesh2020/crypto';
import {
  ProjectSchema,
  SecretsResponseSchema,
  UserSchema,
  ServiceTokenSchema,
  type ProjectDTO,
  type SecretsResponseDTO,
  type UserDTO,
  type ServiceTokenDTO,
  type UploadSecretsInputDTO,
  type AddMemberInputDTO,
  type RegisterUserInputDTO
} from '../schemas/index.js';
import { ApiClientError, AuthenticationError, NotFoundError } from '../errors.js';

export interface ApiClientOptions {
  serverUrl: string;
  signingKeys?: {
    privateKey: string;
    publicKey: string;
  };
  serviceToken?: string;
}

export class ZVaultApiClient {
  private readonly serverUrl: string;
  private readonly signingKeys?: { privateKey: string; publicKey: string };
  private readonly serviceToken?: string;

  constructor(options: ApiClientOptions) {
    this.serverUrl = options.serverUrl.replace(/\/$/, '');
    this.signingKeys = options.signingKeys;
    this.serviceToken = options.serviceToken;
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = options.method || 'GET';
    const url = `${this.serverUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.serviceToken) {
      headers['Authorization'] = `Bearer ${this.serviceToken}`;
    } else if (this.signingKeys) {
      const signed = signPayload(
        options.body || {},
        this.signingKeys.privateKey,
        this.signingKeys.publicKey
      );
      headers['X-Zvault-Signature'] = signed.signature;
      headers['X-Zvault-Public-Key'] = Buffer.from(signed.publicKey, 'utf-8').toString('base64');
      headers['X-Zvault-Timestamp'] = String(signed.timestamp);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = text;
      try {
        const json = JSON.parse(text);
        errorMsg = json.message || text;
      } catch {
        // use raw text
      }

      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(errorMsg);
      }
      if (response.status === 404) {
        throw new NotFoundError(errorMsg);
      }
      throw new ApiClientError(errorMsg, response.status);
    }

    return (await response.json()) as T;
  }

  async registerUser(input: RegisterUserInputDTO): Promise<UserDTO> {
    const data = await this.request<UserDTO>('/api/v1/auth/register', { method: 'POST', body: input });
    return UserSchema.parse(data);
  }

  async getUser(userIdOrEmail: string): Promise<UserDTO> {
    const data = await this.request<UserDTO>(`/api/v1/users/${encodeURIComponent(userIdOrEmail)}`);
    return UserSchema.parse(data);
  }

  async createProject(name: string, environments = ['development', 'staging', 'production']): Promise<ProjectDTO> {
    const data = await this.request<ProjectDTO>('/api/v1/projects', {
      method: 'POST',
      body: { name, environments }
    });
    return ProjectSchema.parse(data);
  }

  async getProject(projectId: string): Promise<ProjectDTO> {
    const data = await this.request<ProjectDTO>(`/api/v1/projects/${encodeURIComponent(projectId)}`);
    return ProjectSchema.parse(data);
  }

  async uploadSecrets(input: UploadSecretsInputDTO): Promise<{ success: boolean; version: number }> {
    return this.request<{ success: boolean; version: number }>(
      `/api/v1/projects/${encodeURIComponent(input.projectId)}/environments/${encodeURIComponent(input.environment)}/secrets`,
      { method: 'PUT', body: input }
    );
  }

  async fetchSecrets(projectId: string, environment: string): Promise<SecretsResponseDTO> {
    const data = await this.request<SecretsResponseDTO>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(environment)}/secrets`
    );
    return SecretsResponseSchema.parse(data);
  }

  async addMember(input: AddMemberInputDTO): Promise<ProjectDTO> {
    const data = await this.request<ProjectDTO>(
      `/api/v1/projects/${encodeURIComponent(input.projectId)}/members`,
      { method: 'POST', body: input }
    );
    return ProjectSchema.parse(data);
  }

  async createServiceToken(projectId: string, environment: string, name: string): Promise<ServiceTokenDTO> {
    const data = await this.request<ServiceTokenDTO>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/tokens`,
      { method: 'POST', body: { environment, name } }
    );
    return ServiceTokenSchema.parse(data);
  }
}
