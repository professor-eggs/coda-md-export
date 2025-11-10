/**
 * Unit tests for ChromeStorageAdapter
 */

import { ChromeStorageAdapter } from '../../../src/adapters/storage/chrome-storage.adapter';

describe('ChromeStorageAdapter', () => {
  let adapter: ChromeStorageAdapter;
  let mockStorage: {
    local: {
      get: jest.Mock;
      set: jest.Mock;
      remove: jest.Mock;
    };
  };

  beforeEach(() => {
    // Mock chrome.storage API
    mockStorage = {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      storage: mockStorage,
    };

    adapter = new ChromeStorageAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfiguration', () => {
    it('should return unconfigured state when no data exists', async () => {
      mockStorage.local.get.mockResolvedValue({});

      const config = await adapter.getConfiguration();

      expect(config).toEqual({
        isConfigured: false,
      });
      expect(mockStorage.local.get).toHaveBeenCalledWith('coda-md-export-config');
    });

    it('should return configuration when valid data exists', async () => {
      const storedConfig = {
        apiKey: 'test-api-key',
        isConfigured: true,
      };
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-config': storedConfig,
      });

      const config = await adapter.getConfiguration();

      expect(config).toEqual(storedConfig);
    });

    it('should return unconfigured state when stored data is invalid', async () => {
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-config': { invalid: 'data' },
      });

      const config = await adapter.getConfiguration();

      expect(config).toEqual({
        isConfigured: false,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.local.get.mockRejectedValue(new Error('Storage error'));

      const config = await adapter.getConfiguration();

      expect(config).toEqual({
        isConfigured: false,
      });
    });
  });

  describe('saveApiKey', () => {
    it('should save valid API key', async () => {
      mockStorage.local.set.mockResolvedValue(undefined);

      await adapter.saveApiKey('test-api-key');

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'coda-md-export-config': {
          apiKey: 'test-api-key',
          isConfigured: true,
        },
      });
    });

    it('should reject empty API key', async () => {
      await expect(adapter.saveApiKey('')).rejects.toThrow();
      expect(mockStorage.local.set).not.toHaveBeenCalled();
    });

    it('should propagate storage errors', async () => {
      mockStorage.local.set.mockRejectedValue(new Error('Storage error'));

      await expect(adapter.saveApiKey('test-api-key')).rejects.toThrow('Storage error');
    });
  });

  describe('clearApiKey', () => {
    it('should remove configuration from storage', async () => {
      mockStorage.local.remove.mockResolvedValue(undefined);

      await adapter.clearApiKey();

      expect(mockStorage.local.remove).toHaveBeenCalledWith('coda-md-export-config');
    });

    it('should propagate storage errors', async () => {
      mockStorage.local.remove.mockRejectedValue(new Error('Storage error'));

      await expect(adapter.clearApiKey()).rejects.toThrow('Storage error');
    });
  });

  describe('hasApiKey', () => {
    it('should return true when API key is configured', async () => {
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-config': {
          apiKey: 'test-api-key',
          isConfigured: true,
        },
      });

      const hasKey = await adapter.hasApiKey();

      expect(hasKey).toBe(true);
    });

    it('should return false when not configured', async () => {
      mockStorage.local.get.mockResolvedValue({});

      const hasKey = await adapter.hasApiKey();

      expect(hasKey).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-config': {
          isConfigured: false,
        },
      });

      const hasKey = await adapter.hasApiKey();

      expect(hasKey).toBe(false);
    });
  });

  describe('getNestedExportSettings', () => {
    it('should return default settings when no data exists', async () => {
      mockStorage.local.get.mockResolvedValue({});

      const settings = await adapter.getNestedExportSettings();

      expect(settings).toEqual({
        includeNested: false,
        depth: 1,
      });
      expect(mockStorage.local.get).toHaveBeenCalledWith('coda-md-export-nested-settings');
    });

    it('should return saved settings when valid data exists', async () => {
      const storedSettings = {
        includeNested: true,
        depth: 3,
      };
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-nested-settings': storedSettings,
      });

      const settings = await adapter.getNestedExportSettings();

      expect(settings).toEqual(storedSettings);
    });

    it('should return default settings when stored data is invalid', async () => {
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-nested-settings': { invalid: 'data' },
      });

      const settings = await adapter.getNestedExportSettings();

      expect(settings).toEqual({
        includeNested: false,
        depth: 1,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.local.get.mockRejectedValue(new Error('Storage error'));

      const settings = await adapter.getNestedExportSettings();

      expect(settings).toEqual({
        includeNested: false,
        depth: 1,
      });
    });

    it('should handle unlimited depth', async () => {
      const storedSettings = {
        includeNested: true,
        depth: 'unlimited',
      };
      mockStorage.local.get.mockResolvedValue({
        'coda-md-export-nested-settings': storedSettings,
      });

      const settings = await adapter.getNestedExportSettings();

      expect(settings).toEqual(storedSettings);
    });
  });

  describe('saveNestedExportSettings', () => {
    it('should save valid settings', async () => {
      mockStorage.local.set.mockResolvedValue(undefined);

      await adapter.saveNestedExportSettings({
        includeNested: true,
        depth: 2,
      });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'coda-md-export-nested-settings': {
          includeNested: true,
          depth: 2,
        },
      });
    });

    it('should save unlimited depth', async () => {
      mockStorage.local.set.mockResolvedValue(undefined);

      await adapter.saveNestedExportSettings({
        includeNested: true,
        depth: 'unlimited',
      });

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'coda-md-export-nested-settings': {
          includeNested: true,
          depth: 'unlimited',
        },
      });
    });

    it('should reject invalid settings', async () => {
      await expect(
        adapter.saveNestedExportSettings({
          includeNested: 'not a boolean' as unknown as boolean,
          depth: 1,
        }),
      ).rejects.toThrow();
      expect(mockStorage.local.set).not.toHaveBeenCalled();
    });

    it('should propagate storage errors', async () => {
      mockStorage.local.set.mockRejectedValue(new Error('Storage error'));

      await expect(
        adapter.saveNestedExportSettings({
          includeNested: true,
          depth: 2,
        }),
      ).rejects.toThrow('Storage error');
    });
  });
});
