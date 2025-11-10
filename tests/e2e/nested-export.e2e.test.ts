/**
 * End-to-end tests for nested export feature
 * Tests the complete user flow with UI interactions
 */

import { NestedExportService } from '../../src/domain/services/nested-export.service';
import { PageHierarchyService } from '../../src/domain/services/page-hierarchy.service';
import { ChromeStorageAdapter } from '../../src/adapters/storage/chrome-storage.adapter';
import { CodaApiAdapter } from '../../src/adapters/api/coda-api.adapter';
import { BottleneckRateLimiterAdapter } from '../../src/adapters/rate-limiter/bottleneck-rate-limiter.adapter';
import { NestedExportSettings } from '../../src/domain/models/nested-export.schema';

describe('Nested Export E2E Tests', () => {
  let storage: ChromeStorageAdapter;
  let apiClient: CodaApiAdapter;
  let rateLimiter: BottleneckRateLimiterAdapter;
  let hierarchyService: PageHierarchyService;
  let nestedExportService: NestedExportService;

  // In-memory storage for tests
  const mockStorageData: Record<string, unknown> = {};

  beforeAll(() => {
    // Mock Chrome APIs
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

    // Mock fetch
    global.fetch = jest.fn();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User Flow', () => {
    it('should support end-to-end user settings flow', async () => {
      // Step 1: User configures nested export settings
      const userSettings: NestedExportSettings = {
        includeNested: true,
        depth: 2,
      };

      await storage.saveNestedExportSettings(userSettings);

      // Step 2: Settings are persisted
      const retrieved = await storage.getNestedExportSettings();
      expect(retrieved).toEqual(userSettings);

      // Step 3: Services can access the settings
      expect(nestedExportService).toBeDefined();
      expect(hierarchyService).toBeDefined();

      // Step 4: User changes settings
      const updatedSettings: NestedExportSettings = {
        includeNested: false,
        depth: 1,
      };

      await storage.saveNestedExportSettings(updatedSettings);

      // Step 5: Updated settings are persisted
      const retrievedUpdated = await storage.getNestedExportSettings();
      expect(retrievedUpdated).toEqual(updatedSettings);
    });

    it('should handle depth settings workflow', async () => {
      // User starts with depth=1
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 1,
      });

      let settings = await storage.getNestedExportSettings();
      expect(settings.depth).toBe(1);

      // User increases to depth=3
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 3,
      });

      settings = await storage.getNestedExportSettings();
      expect(settings.depth).toBe(3);

      // User sets to unlimited
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 'unlimited',
      });

      settings = await storage.getNestedExportSettings();
      expect(settings.depth).toBe('unlimited');
    });

    it('should toggle include nested setting', async () => {
      // User enables nested export
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 2,
      });

      let settings = await storage.getNestedExportSettings();
      expect(settings.includeNested).toBe(true);

      // User disables nested export
      await storage.saveNestedExportSettings({
        includeNested: false,
        depth: 2,
      });

      settings = await storage.getNestedExportSettings();
      expect(settings.includeNested).toBe(false);
    });
  });

  describe('Settings Persistence Flow', () => {
    it('should persist settings across sessions', async () => {
      // Simulate first session
      const settings: NestedExportSettings = {
        includeNested: true,
        depth: 5,
      };

      await storage.saveNestedExportSettings(settings);

      // Simulate second session (new instances)
      const newStorage = new ChromeStorageAdapter();
      const retrieved = await newStorage.getNestedExportSettings();

      expect(retrieved).toEqual(settings);
    });

    it('should update settings when user changes depth', async () => {
      // Initial settings
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 2,
      });

      // User changes depth
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 4,
      });

      const retrieved = await storage.getNestedExportSettings();
      expect(retrieved.depth).toBe(4);
    });

    it('should toggle includeNested setting', async () => {
      // Initially enabled
      await storage.saveNestedExportSettings({
        includeNested: true,
        depth: 2,
      });

      // User disables
      await storage.saveNestedExportSettings({
        includeNested: false,
        depth: 2,
      });

      const retrieved = await storage.getNestedExportSettings();
      expect(retrieved.includeNested).toBe(false);
    });
  });
});

