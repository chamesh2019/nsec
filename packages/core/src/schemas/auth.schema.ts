import { z } from 'zod';

export const ServerUserRoleSchema = z.enum(['admin', 'member']);
export type ServerUserRole = z.infer<typeof ServerUserRoleSchema>;

export const UserPublicKeysSchema = z.object({
  signingKey: z.string().min(1),     // Ed25519 public key PEM
  encryptionKey: z.string().min(1)   // RSA-4096 public key PEM
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: ServerUserRoleSchema.default('member'),
  publicKeys: UserPublicKeysSchema,
  createdAt: z.string()
});

export const RegisterUserInputSchema = z.object({
  email: z.string().email(),
  publicKeys: UserPublicKeysSchema,
  token: z.string().optional() // invite token or bootstrap token
});

export const RotateKeysInputSchema = z.object({
  publicKeys: UserPublicKeysSchema
});

export const InviteTokenSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: ServerUserRoleSchema.default('member'),
  token: z.string().optional(), // returned on creation
  invitedBy: z.string(),
  expiresAt: z.string().optional(),
  createdAt: z.string()
});

export const CreateInviteInputSchema = z.object({
  email: z.string().email(),
  role: ServerUserRoleSchema.default('member'),
  expiresAt: z.string().optional()
});

export const UpdateUserRoleInputSchema = z.object({
  role: ServerUserRoleSchema
});

export type UserPublicKeysDTO = z.infer<typeof UserPublicKeysSchema>;
export type UserDTO = z.infer<typeof UserSchema>;
export type RegisterUserInputDTO = z.infer<typeof RegisterUserInputSchema>;
export type RotateKeysInputDTO = z.infer<typeof RotateKeysInputSchema>;
export type InviteTokenDTO = z.infer<typeof InviteTokenSchema>;
export type CreateInviteInputDTO = z.infer<typeof CreateInviteInputSchema>;
export type UpdateUserRoleInputDTO = z.infer<typeof UpdateUserRoleInputSchema>;

