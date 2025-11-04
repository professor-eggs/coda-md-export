/**
 * Configuration Service - domain service for managing API key configuration
 * This service orchestrates configuration operations using the storage and API client ports
 */

import { StoragePort } from '../ports/storage.port';
import { ApiClientPort } from '../ports/api-client.port';
import { ApiKeyConfigSchema, ValidationResult } from '../models/configuration.schema';
import { UserSchema } from '../models/api.schema';
import { ZodError } from 'zod';

export class ConfigurationService {
  constructor(
    private readonly storage: StoragePort,
    private readonly apiClient: ApiClientPort
  ) {}

  /**
   * Validate and save an API key
   * This method validates the API key by calling the whoami endpoint
   */
  async saveApiKey(apiKey: string): Promise<ValidationResult> {
    try {
      // Trim and validate input
      const trimmedApiKey = apiKey.trim();
      const validatedInput = ApiKeyConfigSchema.parse({ apiKey: trimmedApiKey });

      // Validate with API
      const user = await this.apiClient.whoami(validatedInput.apiKey);

      // Validate response
      const validatedUser = UserSchema.parse(user);

      // Save to storage
      await this.storage.saveApiKey(validatedInput.apiKey);

      return {
        isValid: true,
        userName: validatedUser.name,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          isValid: false,
          error: `Validation error: ${error.errors[0]?.message ?? 'Invalid data'}`,
        };
      }

      if (error instanceof Error) {
        return {
          isValid: false,
          error: `API error: ${error.message}`,
        };
      }

      return {
        isValid: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Get the current configuration
   */
  async getConfiguration(): Promise<{ isConfigured: boolean; apiKey?: string }> {
    const config = await this.storage.getConfiguration();
    return {
      isConfigured: config.isConfigured,
      apiKey: config.apiKey,
    };
  }

  /**
   * Clear the API key configuration
   */
  async clearConfiguration(): Promise<void> {
    await this.storage.clearApiKey();
  }

  /**
   * Check if the API key is configured and valid
   */
  async validateCurrentConfiguration(): Promise<ValidationResult> {
    try {
      const config = await this.storage.getConfiguration();

      if (!config.isConfigured || !config.apiKey) {
        return {
          isValid: false,
          error: 'API key not configured',
        };
      }

      const user = await this.apiClient.whoami(config.apiKey);
      const validatedUser = UserSchema.parse(user);

      return {
        isValid: true,
        userName: validatedUser.name,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          isValid: false,
          error: `Validation failed: ${error.message}`,
        };
      }

      return {
        isValid: false,
        error: 'Unknown validation error',
      };
    }
  }
}
