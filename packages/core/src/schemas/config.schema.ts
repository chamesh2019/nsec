import { z } from 'zod';

export const NullSecConfigSchema = z.object({
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

export const ZVaultConfigSchema = NullSecConfigSchema;

export type NullSecConfig = z.infer<typeof NullSecConfigSchema>;
export type NullSecConfigInput = z.input<typeof NullSecConfigSchema>;

export type ZVaultConfig = NullSecConfig;
export type ZVaultConfigInput = NullSecConfigInput;
