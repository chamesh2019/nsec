import { z } from 'zod';

export const UserPublicKeysSchema = z.object({
  signingKey: z.string().min(1),     // Ed25519 public key PEM
  encryptionKey: z.string().min(1)   // RSA-4096 public key PEM
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  publicKeys: UserPublicKeysSchema,
  createdAt: z.string()
});

export const RegisterUserInputSchema = z.object({
  email: z.string().email(),
  publicKeys: UserPublicKeysSchema
});

export type UserDTO = z.infer<typeof UserSchema>;
export type RegisterUserInputDTO = z.infer<typeof RegisterUserInputSchema>;
