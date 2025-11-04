/**
 * Zod schemas for configuration models
 */

import { z } from 'zod';

/**
 * API Key configuration
 */
export const ApiKeyConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key cannot be empty'),
});

export type ApiKeyConfig = z.infer<typeof ApiKeyConfigSchema>;

/**
 * Configuration state
 */
export const ConfigurationSchema = z.object({
  apiKey: z.string().min(1).optional(),
  isConfigured: z.boolean(),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

/**
 * Validation result
 */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  userName: z.string().optional(),
  error: z.string().optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
