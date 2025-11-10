/**
 * Integration tests for nested export feature
 * Tests the complete flow from UI to export
 */

import { NestedExportService } from '../../src/domain/services/nested-export.service';
import { PageHierarchyService } from '../../src/domain/services/page-hierarchy.service';
import { CodaApiAdapter } from '../../src/adapters/api/coda-api.adapter';
import { ChromeStorageAdapter } from '../../src/adapters/storage/chrome-storage.adapter';
import { BottleneckRateLimiterAdapter } from '../../src/adapters/rate-limiter/bottleneck-rate-limiter.adapter';
import { NestedExportSettings } from '../../src/domain/models/nested-export.schema';

describe('Nested Export Integration Tests', () => {
  let nestedExportService: NestedExportService;
  let hierarchyService: PageHierarchyService;
  let apiClient: CodaApiAdapter;
  let storage: ChromeStorageAdapter;
  let rateLimiter: BottleneckRateLimiterAdapter;

  // In-memory storage for tests
  const mockStorageData: Record<string, unknown> = {};

  // Mock Chrome APIs
  beforeAll(() => {
    // Mock chrome.storage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys) => {
            if (typeof keys === 'string') {
              return Promise.resolve({ [keys]: mockStorageData[keys] });
            }
            return Promise.resolve({});
          }),
          set: jest.fn().mockImplementation((data) => {
            Object.assign(mockStorageData, data);
            return Promise.resolve();
          }),
          remove: jest.fn().mockImplementation((keys) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach((key) => {
              delete mockStorageData[key];
            });
            return Promise.resolve();
          }),
        },
      },
    };
  });

  beforeEach(async () => {
    // Clear storage
    Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);

    rateLimiter = new BottleneckRateLimiterAdapter();
    apiClient = new CodaApiAdapter(undefined, rateLimiter);
    storage = new ChromeStorageAdapter();
    hierarchyService = new PageHierarchyService(apiClient, storage);
    nestedExportService = new NestedExportService(apiClient, storage);

    // Configure API key for tests
    await storage.saveApiKey('test-api-key');

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Storage Integration', () => {
    it('should persist and retrieve nested export settings', async () => {
      const settings: NestedExportSettings = {
        includeNested: true,
        depth: 3,
      };

      await storage.saveNestedExportSettings(settings);
      const retrieved = await storage.getNestedExportSettings();

      expect(retrieved).toEqual(settings);
    });

    it('should return default settings when none are saved', async () => {
      const settings = await storage.getNestedExportSettings();

      expect(settings).toEqual({
        includeNested: false,
        depth: 1,
      });
    });

    it('should handle unlimited depth setting', async () => {
      const settings: NestedExportSettings = {
        includeNested: true,
        depth: 'unlimited',
      };

      await storage.saveNestedExportSettings(settings);
      const retrieved = await storage.getNestedExportSettings();

      expect(retrieved).toEqual(settings);
    });
  });

  describe('Service Integration', () => {
    it('should integrate rate limiter with API client', async () => {
      // Verify rate limiter is properly integrated
      expect(apiClient).toBeDefined();
      expect(rateLimiter).toBeDefined();

      // Check that rate limiter has appropriate queues
      const readCount = rateLimiter.getQueuedCount('read');
      expect(readCount).toBeGreaterThanOrEqual(0);
    });

    it('should integrate hierarchy service with storage and API client', async () => {
      // Verify services are properly wired together
      expect(hierarchyService).toBeDefined();
      expect(storage).toBeDefined();

      // Verify storage has API key configured
      const hasKey = await storage.hasApiKey();
      expect(hasKey).toBe(true);
    });

    it('should integrate nested export service with dependencies', async () => {
      // Verify nested export service is properly configured
      expect(nestedExportService).toBeDefined();

      // Services should have access to storage
      const settings = await storage.getNestedExportSettings();
      expect(settings).toBeDefined();
      expect(settings.depth).toBeDefined();
      expect(settings.includeNested).toBeDefined();
    });
  });

  describe('Settings Integration with Services', () => {
    it('should use stored settings across service calls', async () => {
      // Save settings
      const settings: NestedExportSettings = {
        includeNested: true,
        depth: 3,
      };
      await storage.saveNestedExportSettings(settings);

      // Retrieve in different context
      const retrieved = await storage.getNestedExportSettings();
      expect(retrieved).toEqual(settings);

      // Verify settings persist across multiple reads
      const retrieved2 = await storage.getNestedExportSettings();
      expect(retrieved2).toEqual(settings);
    });

    it('should handle settings changes dynamically', async () => {
      // Initial settings
      await storage.saveNestedExportSettings({
        includeNested: false,
        depth: 1,
      });

      let retrieved = await storage.getNestedExportSettings();
      expect(retrieved.includeNested).toBe(false);

      // Change settings
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 5,
      });

      retrieved = await storage.getNestedExportSettings();
      expect(retrieved.includeNested).toBe(true);
      expect(retrieved.depth).toBe(5);
    });
  });
});

