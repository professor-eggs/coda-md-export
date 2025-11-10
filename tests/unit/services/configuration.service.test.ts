/**
 * Unit tests for ConfigurationService
 */

import { ConfigurationService } from '../../../src/domain/services/configuration.service';
import { StoragePort } from '../../../src/domain/ports/storage.port';
import { ApiClientPort } from '../../../src/domain/ports/api-client.port';
import { User } from '../../../src/domain/models/api.schema';

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let mockStorage: jest.Mocked<StoragePort>;
  let mockApiClient: jest.Mocked<ApiClientPort>;

  const mockUser: User = {
    name: 'John Doe',
    loginId: 'john@example.com',
    type: 'user',
    scoped: false,
    tokenName: 'Test Token',
    href: 'https://coda.io/apis/v1/whoami',
    workspace: {
      id: 'ws-123',
      type: 'workspace',
      browserLink: 'https://coda.io/workspace/ws-123',
      name: 'Test Workspace',
    },
  };

  beforeEach(() => {
    mockStorage = {
      getConfiguration: jest.fn(),
      saveApiKey: jest.fn(),
      clearApiKey: jest.fn(),
      hasApiKey: jest.fn(),
      getNestedExportSettings: jest.fn(),
      saveNestedExportSettings: jest.fn(),
    };

    mockApiClient = {
      whoami: jest.fn(),
      resolveBrowserLink: jest.fn(),
      listPages: jest.fn(),
      getPage: jest.fn(),
      beginPageExport: jest.fn(),
      getExportStatus: jest.fn(),
      downloadExport: jest.fn(),
    };

    service = new ConfigurationService(mockStorage, mockApiClient);
  });

  describe('saveApiKey', () => {
    it('should validate and save a valid API key', async () => {
      mockApiClient.whoami.mockResolvedValue(mockUser);
      mockStorage.saveApiKey.mockResolvedValue(undefined);

      const result = await service.saveApiKey('valid-api-key');

      expect(result.isValid).toBe(true);
      expect(result.userName).toBe('John Doe');
      expect(result.error).toBeUndefined();
      expect(mockApiClient.whoami).toHaveBeenCalledWith('valid-api-key');
      expect(mockStorage.saveApiKey).toHaveBeenCalledWith('valid-api-key');
    });

    it('should reject empty API key', async () => {
      const result = await service.saveApiKey('');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(mockApiClient.whoami).not.toHaveBeenCalled();
      expect(mockStorage.saveApiKey).not.toHaveBeenCalled();
    });

    it('should handle API validation failure', async () => {
      mockApiClient.whoami.mockRejectedValue(new Error('Invalid API key'));

      const result = await service.saveApiKey('invalid-api-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('API error: Invalid API key');
      expect(mockStorage.saveApiKey).not.toHaveBeenCalled();
    });

    it('should handle invalid response from API', async () => {
      // @ts-expect-error - intentionally invalid response for testing
      mockApiClient.whoami.mockResolvedValue({ invalid: 'data' });

      const result = await service.saveApiKey('api-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(mockStorage.saveApiKey).not.toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      mockApiClient.whoami.mockResolvedValue(mockUser);
      mockStorage.saveApiKey.mockRejectedValue(new Error('Storage failed'));

      const result = await service.saveApiKey('valid-api-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('API error: Storage failed');
    });

    it('should handle unknown errors', async () => {
      mockApiClient.whoami.mockRejectedValue('unknown error');

      const result = await service.saveApiKey('api-key');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  describe('getConfiguration', () => {
    it('should return configured state with API key', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const config = await service.getConfiguration();

      expect(config).toEqual({
        isConfigured: true,
        apiKey: 'test-api-key',
      });
    });

    it('should return unconfigured state', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      const config = await service.getConfiguration();

      expect(config).toEqual({
        isConfigured: false,
      });
    });
  });

  describe('clearConfiguration', () => {
    it('should clear the API key', async () => {
      mockStorage.clearApiKey.mockResolvedValue(undefined);

      await service.clearConfiguration();

      expect(mockStorage.clearApiKey).toHaveBeenCalled();
    });

    it('should propagate storage errors', async () => {
      mockStorage.clearApiKey.mockRejectedValue(new Error('Storage error'));

      await expect(service.clearConfiguration()).rejects.toThrow('Storage error');
    });
  });

  describe('validateCurrentConfiguration', () => {
    it('should validate a configured API key', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'valid-api-key',
      });
      mockApiClient.whoami.mockResolvedValue(mockUser);

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.userName).toBe('John Doe');
      expect(mockApiClient.whoami).toHaveBeenCalledWith('valid-api-key');
    });

    it('should return invalid when not configured', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key not configured');
      expect(mockApiClient.whoami).not.toHaveBeenCalled();
    });

    it('should return invalid when API key is missing', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: undefined,
      });

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key not configured');
    });

    it('should handle API validation failure', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'invalid-key',
      });
      mockApiClient.whoami.mockRejectedValue(new Error('Unauthorized'));

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation failed: Unauthorized');
    });

    it('should handle invalid API response', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'valid-key',
      });
      // @ts-expect-error - intentionally invalid response
      mockApiClient.whoami.mockResolvedValue({ invalid: 'data' });

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle unknown errors', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'valid-key',
      });
      mockApiClient.whoami.mockRejectedValue('unknown error');

      const result = await service.validateCurrentConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unknown validation error');
    });
  });
});
