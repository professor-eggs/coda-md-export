/**
 * Unit tests for PageDetectionService
 */

import { PageDetectionService } from '../../../src/domain/services/page-detection.service';
import { ApiClientPort } from '../../../src/domain/ports/api-client.port';
import { StoragePort } from '../../../src/domain/ports/storage.port';

// Mock chrome.tabs API
global.chrome = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tabs: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('PageDetectionService', () => {
  let service: PageDetectionService;
  let mockTabs: {
    query: jest.Mock;
  };
  let mockApiClient: jest.Mocked<ApiClientPort>;
  let mockStorage: jest.Mocked<StoragePort>;

  beforeEach(() => {
    mockTabs = {
      query: jest.fn(),
    };

    mockApiClient = {
      whoami: jest.fn(),
      resolveBrowserLink: jest.fn(),
      beginPageExport: jest.fn(),
      getExportStatus: jest.fn(),
      downloadExport: jest.fn(),
    };

    mockStorage = {
      getConfiguration: jest.fn(),
      saveApiKey: jest.fn(),
      clearApiKey: jest.fn(),
      hasApiKey: jest.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.chrome.tabs as any) = mockTabs;

    service = new PageDetectionService(mockApiClient, mockStorage);
  });

  describe('getCurrentPageInfo', () => {
    it('should detect page info from active Coda tab using resolveBrowserLink', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC/Page_pXYZ',
      };

      const mockApiLink = {
        type: 'apiLink' as const,
        href: 'https://coda.io/apis/v1/resolveBrowserLink?url=...',
        browserLink: mockTab.url,
        resource: {
          type: 'page' as const,
          id: 'canvas-XYZ123',
          href: 'https://coda.io/apis/v1/docs/ABC123/pages/canvas-XYZ123',
          name: 'Test Page',
        },
      };

      mockTabs.query.mockResolvedValue([mockTab]);
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });
      mockApiClient.resolveBrowserLink.mockResolvedValue(mockApiLink);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(true);
      expect(result.pageInfo).toEqual({
        docId: 'ABC123',
        pageId: 'canvas-XYZ123',
      });
      expect(mockTabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(mockApiClient.resolveBrowserLink).toHaveBeenCalledWith('test-api-key', mockTab.url);
    });

    it('should return not detected for non-Coda URL', async () => {
      const mockTab = {
        id: 1,
        url: 'https://google.com',
      };

      mockTabs.query.mockResolvedValue([mockTab]);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('Not a Coda page');
      expect(result.url).toBe('https://google.com');
      expect(mockApiClient.resolveBrowserLink).not.toHaveBeenCalled();
    });

    it('should return error when no active tab', async () => {
      mockTabs.query.mockResolvedValue([]);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should return error when tab has no ID', async () => {
      mockTabs.query.mockResolvedValue([{ url: 'https://coda.io' }]);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should return error when tab has no URL', async () => {
      mockTabs.query.mockResolvedValue([{ id: 1 }]);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('No active tab found');
    });

    it('should return error when API key is not configured', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC/Page_pXYZ',
      };

      mockTabs.query.mockResolvedValue([mockTab]);
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('API key not configured');
      expect(mockApiClient.resolveBrowserLink).not.toHaveBeenCalled();
    });

    it('should return error when resolveBrowserLink fails', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC/Page_pXYZ',
      };

      mockTabs.query.mockResolvedValue([mockTab]);
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });
      mockApiClient.resolveBrowserLink.mockRejectedValue(new Error('API Error'));

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('Error detecting page: API Error');
    });

    it('should return error when resolved resource is not a page', async () => {
      const mockTab = {
        id: 1,
        url: 'https://coda.io/d/Test-Doc_dABC',
      };

      const mockApiLink = {
        type: 'apiLink' as const,
        href: 'https://coda.io/apis/v1/resolveBrowserLink?url=...',
        browserLink: mockTab.url,
        resource: {
          type: 'doc' as const,
          id: 'ABC123',
          href: 'https://coda.io/apis/v1/docs/ABC123',
          name: 'Test Doc',
        },
      };

      mockTabs.query.mockResolvedValue([mockTab]);
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });
      mockApiClient.resolveBrowserLink.mockResolvedValue(mockApiLink);

      const result = await service.getCurrentPageInfo();

      expect(result.detected).toBe(false);
      expect(result.error).toBe('URL points to a doc, not a page');
    });
  });
});
