import { z } from 'zod';
import { EncryptedProjectKeySchema } from './secrets.schema.js';

export const ProjectMemberRoleSchema = z.enum(['admin', 'developer', 'viewer']);

export const ProjectMemberSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: ProjectMemberRoleSchema,
  environments: z.array(z.string()), // allowed environments
  joinedAt: z.string()
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  environments: z.array(z.string()),
  members: z.array(ProjectMemberSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ServiceTokenSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environment: z.string(),
  name: z.string(),
  token: z.string().optional(), // returned only upon creation
  expiresAt: z.string().optional(),
  createdAt: z.string()
});

export const AddMemberInputSchema = z.object({
  projectId: z.string(),
  email: z.string().email(),
  role: ProjectMemberRoleSchema.default('developer'),
  environments: z.array(z.string()),
  environmentKeys: z.record(z.string(), EncryptedProjectKeySchema) // env -> encryptedKey
});

export type ProjectDTO = z.infer<typeof ProjectSchema>;
export type ProjectMemberDTO = z.infer<typeof ProjectMemberSchema>;
export type ServiceTokenDTO = z.infer<typeof ServiceTokenSchema>;
export type AddMemberInputDTO = z.infer<typeof AddMemberInputSchema>;
