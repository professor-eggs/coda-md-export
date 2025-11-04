/**
 * End-to-end tests for complete configuration scenario
 * These tests simulate the full user journey
 */

import { ConfigurationService } from '../../src/domain/services/configuration.service';
import { ChromeStorageAdapter } from '../../src/adapters/storage/chrome-storage.adapter';
import { CodaApiAdapter } from '../../src/adapters/api/coda-api.adapter';

// Mock fetch globally
global.fetch = jest.fn();

describe('Configuration E2E Tests', () => {
  const mockFetch = global.fetch as jest.Mock;
  let mockStorageData: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorageData = {};

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
  });

  describe('User journey: First-time setup', () => {
    it('should complete full first-time configuration flow', async () => {
      // User opens extension for the first time
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      // Check initial state - should be unconfigured
      const initialConfig = await service.getConfiguration();
      expect(initialConfig.isConfigured).toBe(false);
      expect(initialConfig.apiKey).toBeUndefined();

      // User enters API key and clicks save
      const mockUser = {
        name: 'Alice Developer',
        loginId: 'alice@company.com',
        type: 'user',
        scoped: false,
        tokenName: 'Alice Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-alice-123',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-alice-123',
          name: "Alice's Workspace",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const saveResult = await service.saveApiKey('alice-api-key-xyz');

      // Verify successful save
      expect(saveResult.isValid).toBe(true);
      expect(saveResult.userName).toBe('Alice Developer');
      expect(saveResult.error).toBeUndefined();

      // User closes and reopens extension
      const newStorage = new ChromeStorageAdapter();
      const newApiClient = new CodaApiAdapter();
      const newService = new ConfigurationService(newStorage, newApiClient);

      // Configuration should persist
      const persistedConfig = await newService.getConfiguration();
      expect(persistedConfig.isConfigured).toBe(true);
      expect(persistedConfig.apiKey).toBe('alice-api-key-xyz');

      // Extension validates on open
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const validationResult = await newService.validateCurrentConfiguration();
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.userName).toBe('Alice Developer');
    });
  });

  describe('User journey: Invalid API key recovery', () => {
    it('should handle and recover from invalid API key', async () => {
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      // User enters invalid API key
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: 'The API token is invalid',
        }),
      });

      const firstAttempt = await service.saveApiKey('wrong-key');
      expect(firstAttempt.isValid).toBe(false);
      expect(firstAttempt.error).toContain('The API token is invalid');

      // Configuration should not be saved
      const config1 = await service.getConfiguration();
      expect(config1.isConfigured).toBe(false);

      // User gets correct API key and tries again
      const mockUser = {
        name: 'Bob User',
        loginId: 'bob@company.com',
        type: 'user',
        scoped: false,
        tokenName: 'Bob Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-bob-456',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-bob-456',
          name: "Bob's Workspace",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const secondAttempt = await service.saveApiKey('correct-key');
      expect(secondAttempt.isValid).toBe(true);
      expect(secondAttempt.userName).toBe('Bob User');

      // Now configuration should be saved
      const config2 = await service.getConfiguration();
      expect(config2.isConfigured).toBe(true);
      expect(config2.apiKey).toBe('correct-key');
    });
  });

  describe('User journey: Reconfiguration', () => {
    it('should allow user to change API key', async () => {
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      // Initial configuration
      const mockUser1 = {
        name: 'User One',
        loginId: 'user1@company.com',
        type: 'user',
        scoped: false,
        tokenName: 'Token 1',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-1',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-1',
          name: 'Workspace 1',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser1,
      });

      await service.saveApiKey('first-key');

      // User decides to change API key
      await service.clearConfiguration();

      const clearedConfig = await service.getConfiguration();
      expect(clearedConfig.isConfigured).toBe(false);

      // User configures new API key
      const mockUser2 = {
        name: 'User Two',
        loginId: 'user2@company.com',
        type: 'user',
        scoped: false,
        tokenName: 'Token 2',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-2',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-2',
          name: 'Workspace 2',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser2,
      });

      const newSaveResult = await service.saveApiKey('second-key');
      expect(newSaveResult.isValid).toBe(true);
      expect(newSaveResult.userName).toBe('User Two');

      const newConfig = await service.getConfiguration();
      expect(newConfig.apiKey).toBe('second-key');
    });
  });

  describe('User journey: Network issues', () => {
    it('should handle transient network failures gracefully', async () => {
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      // First attempt fails due to network
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const firstAttempt = await service.saveApiKey('test-key');
      expect(firstAttempt.isValid).toBe(false);
      expect(firstAttempt.error).toContain('Failed to fetch');

      // User tries again, network is back
      const mockUser = {
        name: 'Network Recovery User',
        loginId: 'network@company.com',
        type: 'user',
        scoped: false,
        tokenName: 'Network Token',
        href: 'https://coda.io/apis/v1/whoami',
        workspace: {
          id: 'ws-network',
          type: 'workspace',
          browserLink: 'https://coda.io/workspace/ws-network',
          name: 'Network Workspace',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const secondAttempt = await service.saveApiKey('test-key');
      expect(secondAttempt.isValid).toBe(true);
      expect(secondAttempt.userName).toBe('Network Recovery User');
    });
  });

  describe('User journey: Invalid data handling', () => {
    it('should reject empty API key before making request', async () => {
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      const result = await service.saveApiKey('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');

      // Should not have made any API calls
      expect(mockFetch).not.toHaveBeenCalled();

      // Should not have saved anything
      const config = await service.getConfiguration();
      expect(config.isConfigured).toBe(false);
    });

    it('should handle whitespace-only API key', async () => {
      const storage = new ChromeStorageAdapter();
      const apiClient = new CodaApiAdapter();
      const service = new ConfigurationService(storage, apiClient);

      const result = await service.saveApiKey('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
