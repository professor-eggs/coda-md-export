/**
 * Integration tests for Page Detection flow
 * Tests the integration between PageDetectionService, ApiClient, and Storage
 */

import { PageDetectionService } from '../../src/domain/services/page-detection.service';
import { CodaApiAdapter } from '../../src/adapters/api/coda-api.adapter';
import { ChromeStorageAdapter } from '../../src/adapters/storage/chrome-storage.adapter';

// Mock chrome.tabs and chrome.storage APIs
global.chrome = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tabs: {
    query: jest.fn(),
  } as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  } as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock fetch
global.fetch = jest.fn();

describe('Page Detection Integration Tests', () => {
  let pageDetectionService: PageDetectionService;
  let apiClient: CodaApiAdapter;
  let storage: ChromeStorageAdapter;

  beforeEach(() => {
    apiClient = new CodaApiAdapter();
    storage = new ChromeStorageAdapter();
    pageDetectionService = new PageDetectionService(apiClient, storage);

    jest.clearAllMocks();
  });

  describe('Full page detection flow', () => {
    it('should detect page from Coda URL using API', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC123/Page_pXYZ456',
      };

      const mockApiLink = {
        type: 'apiLink',
        href: 'https://coda.io/apis/v1/resolveBrowserLink?url=...',
        browserLink: mockTab.url,
        resource: {
          type: 'page',
          id: 'canvas-XYZ456',
          href: 'https://coda.io/apis/v1/docs/ABC123/pages/canvas-XYZ456',
          name: 'Test Page',
        },
      };

      // Mock chrome APIs
      (chrome.tabs.query as jest.Mock).mockResolvedValue([mockTab]);
      (chrome.storage.local.get as jest.Mock).mockImplementation((key) => {
        if (key === 'coda-md-export-config') {
          return Promise.resolve({
            'coda-md-export-config': {
              apiKey: 'test-api-key-123',
              isConfigured: true,
            },
          });
        }
        return Promise.resolve({});
      });

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiLink,
      });

      const result = await pageDetectionService.getCurrentPageInfo();

      expect(result.detected).toBe(true);
      expect(result.pageInfo).toEqual({
        docId: 'ABC123',
        pageId: 'canvas-XYZ456',
      });
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('should handle non-Coda URL', async () => {
      const mockTab = {
        id: 1,
        url: 'https://example.com',
      };

      (chrome.tabs.query as jest.Mock).mockResolvedValue([mockTab]);

      const result = await pageDetectionService.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('Not a Coda page');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle missing API key', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC123/Page_pXYZ456',
      };

      (chrome.tabs.query as jest.Mock).mockResolvedValue([mockTab]);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

      const result = await pageDetectionService.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('API key not configured');
    });

    it('should handle API errors', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC123/Page_pXYZ456',
      };

      (chrome.tabs.query as jest.Mock).mockResolvedValue([mockTab]);
      (chrome.storage.local.get as jest.Mock).mockImplementation((key) => {
        if (key === 'coda-md-export-config') {
          return Promise.resolve({
            'coda-md-export-config': {
              apiKey: 'test-api-key-123',
              isConfigured: true,
            },
          });
        }
        return Promise.resolve({});
      });

      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: 'Invalid API key',
        }),
      });

      const result = await pageDetectionService.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });
  });
});
