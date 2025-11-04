/**
 * Storage port - interface for persistent storage operations
 * This abstraction allows us to swap storage implementations (e.g., Chrome storage, localStorage, etc.)
 */

import { Configuration } from '../models/configuration.schema';

export interface StoragePort {
  /**
   * Get the current configuration
   */
  getConfiguration(): Promise<Configuration>;

  /**
   * Save an API key
   */
  saveApiKey(apiKey: string): Promise<void>;

  /**
   * Clear the API key
   */
  clearApiKey(): Promise<void>;

  /**
   * Check if an API key is configured
   */
  hasApiKey(): Promise<boolean>;
}
