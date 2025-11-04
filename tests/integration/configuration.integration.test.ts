/**
 * Integration tests for configuration flow
 * Tests the interaction between ConfigurationService, Storage, and API adapters
 */

import { ConfigurationService } from '../../src/domain/services/configuration.service';
import { ChromeStorageAdapter } from '../../src/adapters/storage/chrome-storage.adapter';
import { CodaApiAdapter } from '../../src/adapters/api/coda-api.adapter';

// Mock fetch globally
global.fetch = jest.fn();

describe('Configuration Integration Tests', () => {
  let service: ConfigurationService;
  let storage: ChromeStorageAdapter;
  let apiClient: CodaApiAdapter;
  const mockFetch = global.fetch as jest.Mock;

  let mockStorageData: Record<string, unknown> = {};

  beforeEach(() => {
    // Reset mock storage data
    mockStorageData = {};

    // Mock chrome.storage API
    const mockStorage = {
      local: {
        get: jest.fn((key: string) => {
          return Promise.resolve({ [key]: mockStorageData[key] });
        }),
        set: jest.fn((data: Record<string, unknown>) => {
          Object.assign(mockStorageData, data);
          return Promise.resolve();
        }),
        remove: jest.fn((key: string) => {
          delete mockStorageData[key];
          return Promise.resolve();
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      storage: mockStorage,
    };

    mockFetch.mockClear();

    // Create real instances (not mocks)
    storage = new ChromeStorageAdapter();
    apiClient = new CodaApiAdapter();
    service = new ConfigurationService(storage, apiClient);
  });

  describe('Complete configuration flow', () => {
    it('should successfully configure with valid API key', async () => {
      const mockUser = {
        name: 'Integration Test User',
        loginId: 'test@example.com',
        type: 'user',
        scoped: false,
        tokenName: 'Integration Test Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-integration',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-integration',
          name: 'Integration Test Workspace',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Save API key
      const saveResult = await service.saveApiKey('integration-test-key');

      expect(saveResult.isValid).toBe(true);
      expect(saveResult.userName).toBe('Integration Test User');

      // Verify it's stored
      const config = await service.getConfiguration();
      expect(config.isConfigured).toBe(true);
      expect(config.apiKey).toBe('integration-test-key');

      // Verify it can be validated
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const validateResult = await service.validateCurrentConfiguration();
      expect(validateResult.isValid).toBe(true);
      expect(validateResult.userName).toBe('Integration Test User');
    });

    it('should handle invalid API key gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: 'Invalid API token',
        }),
      });

      const result = await service.saveApiKey('invalid-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid API token');

      // Verify nothing was stored
      const config = await service.getConfiguration();
      expect(config.isConfigured).toBe(false);
    });

    it('should clear configuration correctly', async () => {
      const mockUser = {
        name: 'Test User',
        loginId: 'test@example.com',
        type: 'user',
        scoped: false,
        tokenName: 'Test Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-test',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-test',
          name: 'Test Workspace',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Configure
      await service.saveApiKey('test-key');

      // Verify configured
      let config = await service.getConfiguration();
      expect(config.isConfigured).toBe(true);

      // Clear
      await service.clearConfiguration();

      // Verify cleared
      config = await service.getConfiguration();
      expect(config.isConfigured).toBe(false);
      expect(config.apiKey).toBeUndefined();
    });

    it('should handle network errors during validation', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.saveApiKey('test-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      const result = await service.saveApiKey('test-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('Storage persistence', () => {
    it('should persist configuration across service instances', async () => {
      const mockUser = {
        name: 'Persistence Test',
        loginId: 'persist@example.com',
        type: 'user',
        scoped: false,
        tokenName: 'Persist Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-persist',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-persist',
          name: 'Persist Workspace',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      // Save with first service instance
      await service.saveApiKey('persist-key');

      // Create new service instance with same storage
      const newStorage = new ChromeStorageAdapter();
      const newApiClient = new CodaApiAdapter();
      const newService = new ConfigurationService(newStorage, newApiClient);

      // Verify configuration persists
      const config = await newService.getConfiguration();
      expect(config.isConfigured).toBe(true);
      expect(config.apiKey).toBe('persist-key');
    });
  });

  describe('API client behavior', () => {
    it('should properly format authorization header', async () => {
      const mockUser = {
        name: 'Header Test',
        loginId: 'header@example.com',
        type: 'user',
        scoped: false,
        tokenName: 'Header Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-header',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-header',
          name: 'Header Workspace',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      await service.saveApiKey('test-bearer-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/whoami',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-bearer-token',
          }),
        })
      );
    });
  });
});
