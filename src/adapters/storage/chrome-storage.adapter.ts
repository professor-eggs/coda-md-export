/**
 * Chrome Storage Adapter - implements StoragePort using Chrome's storage API
 */

import { StoragePort } from '../../domain/ports/storage.port';
import { Configuration, ConfigurationSchema } from '../../domain/models/configuration.schema';
import {
  NestedExportSettings,
  NestedExportSettingsSchema,
  DEFAULT_NESTED_EXPORT_SETTINGS,
} from '../../domain/models/nested-export.schema';

const STORAGE_KEY = 'coda-md-export-config';
const NESTED_EXPORT_SETTINGS_KEY = 'coda-md-export-nested-settings';

export class ChromeStorageAdapter implements StoragePort {
  async getConfiguration(): Promise<Configuration> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data: unknown = result[STORAGE_KEY];

      if (!data) {
        return {
          isConfigured: false,
        };
      }

      // Validate with Zod
      const config = ConfigurationSchema.parse(data);
      return config;
    } catch (error) {
      // If validation fails, return unconfigured state
      return {
        isConfigured: false,
      };
    }
  }

  async saveApiKey(apiKey: string): Promise<void> {
    const config: Configuration = {
      apiKey,
      isConfigured: true,
    };

    // Validate before saving
    ConfigurationSchema.parse(config);

    await chrome.storage.local.set({
      [STORAGE_KEY]: config,
    });
  }

  async clearApiKey(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  async hasApiKey(): Promise<boolean> {
    const config = await this.getConfiguration();
    return config.isConfigured && Boolean(config.apiKey);
  }

  async getNestedExportSettings(): Promise<NestedExportSettings> {
    try {
      const result = await chrome.storage.local.get(NESTED_EXPORT_SETTINGS_KEY);
      const data: unknown = result[NESTED_EXPORT_SETTINGS_KEY];

      if (!data) {
        return DEFAULT_NESTED_EXPORT_SETTINGS;
      }

      // Validate with Zod
      const settings = NestedExportSettingsSchema.parse(data);
      return settings;
    } catch (error) {
      // If validation fails, return default settings
      return DEFAULT_NESTED_EXPORT_SETTINGS;
    }
  }

  async saveNestedExportSettings(settings: NestedExportSettings): Promise<void> {
    // Validate before saving
    NestedExportSettingsSchema.parse(settings);

    await chrome.storage.local.set({
      [NESTED_EXPORT_SETTINGS_KEY]: settings,
    });
  }
}
