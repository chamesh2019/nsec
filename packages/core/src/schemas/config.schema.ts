import { z } from 'zod';

export const ZVaultConfigSchema = z.object({
  project: z
    .string()
    .min(1, 'Project name is required')
    .max(64)
    .regex(/^[a-z0-9-_]+$/, 'Project name must contain only lowercase alphanumeric characters, dashes, and underscores.'),
  defaultEnvironment: z.string().default('development'),
  serverUrl: z.string().url().default('http://localhost:4000'),
  environments: z.array(z.string()).default(['development', 'staging', 'production']),
  storage: z.enum(['keyring', 'file', 'memory']).default('keyring')
});

export type ZVaultConfig = z.infer<typeof ZVaultConfigSchema>;
export type ZVaultConfigInput = z.input<typeof ZVaultConfigSchema>;
