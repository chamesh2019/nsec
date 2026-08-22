import { z } from 'zod';

export const EncryptedSecretsPayloadSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  version: z.number().int().default(1)
});

export const EncryptedProjectKeySchema = z.object({
  encryptedKey: z.string().min(1),
  algorithm: z.literal('RSA-OAEP-4096')
});

export const SecretsResponseSchema = z.object({
  projectId: z.string(),
  environment: z.string(),
  secretsPayload: EncryptedSecretsPayloadSchema,
  encryptedProjectKey: EncryptedProjectKeySchema,
  version: z.number().int(),
  updatedAt: z.string()
});

export const UploadSecretsInputSchema = z.object({
  projectId: z.string(),
  environment: z.string(),
  secretsPayload: EncryptedSecretsPayloadSchema,
  projectKeys: z.record(z.string(), EncryptedProjectKeySchema) // userId -> encryptedKey
});

export type EncryptedSecretsPayloadDTO = z.infer<typeof EncryptedSecretsPayloadSchema>;
export type EncryptedProjectKeyDTO = z.infer<typeof EncryptedProjectKeySchema>;
export type SecretsResponseDTO = z.infer<typeof SecretsResponseSchema>;
export type UploadSecretsInputDTO = z.infer<typeof UploadSecretsInputSchema>;
