/**
 * Unit tests for NestedExportService
 */

import { NestedExportService } from '../../../src/domain/services/nested-export.service';
import { ApiClientPort } from '../../../src/domain/ports/api-client.port';
import { StoragePort } from '../../../src/domain/ports/storage.port';
import { CodaPageIdentifier, Page } from '../../../src/domain/models/api.schema';

describe('NestedExportService', () => {
  let service: NestedExportService;
  let mockApiClient: jest.Mocked<ApiClientPort>;
  let mockStorage: jest.Mocked<StoragePort>;

  const testPageInfo: CodaPageIdentifier = {
    docId: 'doc-123',
    pageId: 'page-root',
  };

  beforeEach(() => {
    mockApiClient = {
      whoami: jest.fn(),
      resolveBrowserLink: jest.fn(),
      listPages: jest.fn(),
      getPage: jest.fn(),
      beginPageExport: jest.fn(),
      getExportStatus: jest.fn(),
      downloadExport: jest.fn(),
    };

    mockStorage = {
      getConfiguration: jest.fn(),
      saveApiKey: jest.fn(),
      clearApiKey: jest.fn(),
      hasApiKey: jest.fn(),
      getNestedExportSettings: jest.fn(),
      saveNestedExportSettings: jest.fn(),
    };

    service = new NestedExportService(mockApiClient, mockStorage);
  });

  describe('exportNestedPages', () => {
    it('should export single page and return combined content', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const mockRootPage: Page = {
        id: 'page-root',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root',
        name: 'Root Page',
        browserLink: 'https://coda.io/d/doc-123/_sroot',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage.mockResolvedValue(mockRootPage);

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
        downloadLink: 'https://s3.aws.com/export-123.md',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Root Page Content',
      });

      const result = await service.exportNestedPages(testPageInfo, {
        includeNested: false,
        depth: 0,
      });

      expect(result.success).toBe(true);
      expect(result.totalPages).toBe(1);
      expect(result.successfulPages).toBe(1);
      expect(result.failedPages).toHaveLength(0);
      expect(result.combinedContent).toContain('Root Page Content');
      expect(result.combinedContent).toContain('Page: Root Page');
    });

    it('should export multiple nested pages', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const mockRootPage: Page = {
        id: 'page-root',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root',
        name: 'Root',
        browserLink: 'https://coda.io/d/doc-123/_sroot',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [
          {
            id: 'page-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
            name: 'Child',
            browserLink: 'https://coda.io/d/doc-123/_s1',
          },
        ],
      };

      const mockChild: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage
        // First two calls are for hierarchy discovery
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild)
        // Next two calls are during export for updatedAt check
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild);

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
        downloadLink: 'https://s3.aws.com/export.md',
      });

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '# Root Content',
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '# Child Content',
        });

      const result = await service.exportNestedPages(testPageInfo, {
        includeNested: true,
        depth: 1,
      });

      expect(result.success).toBe(true);
      expect(result.totalPages).toBe(2);
      expect(result.successfulPages).toBe(2);
      expect(result.failedPages).toHaveLength(0);
      expect(result.combinedContent).toContain('Root Content');
      expect(result.combinedContent).toContain('Child Content');
      expect(result.combinedContent).toContain('Page: Root');
      expect(result.combinedContent).toContain('Page: Child');
    }, 15000); // Increased timeout due to 3s wait per export

    it('should handle partial failures gracefully', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const mockRootPage: Page = {
        id: 'page-root',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root',
        name: 'Root',
        browserLink: 'https://coda.io/d/doc-123/_sroot',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [
          {
            id: 'page-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
            name: 'Child',
            browserLink: 'https://coda.io/d/doc-123/_s1',
          },
        ],
      };

      const mockChild: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage
        // First two calls are for hierarchy discovery
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild)
        // Next two calls are during export for updatedAt check
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild);

      // Root succeeds, child fails (with retries)
      mockApiClient.beginPageExport
        .mockResolvedValueOnce({
          id: 'export-root',
          status: 'inProgress',
          href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-root',
        })
        // Child export will fail 4 times (initial + 3 retries)
        .mockRejectedValue(new Error('Export failed'));

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-root',
        status: 'complete',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-root',
        downloadLink: 'https://s3.aws.com/export.md',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Root Content',
      });

      const result = await service.exportNestedPages(testPageInfo, {
        includeNested: true,
        depth: 1,
      });

      expect(result.success).toBe(false);
      expect(result.totalPages).toBe(2);
      expect(result.successfulPages).toBe(1);
      expect(result.failedPages).toHaveLength(1);
      expect(result.failedPages[0]?.pageId).toBe('page-1');
      expect(result.combinedContent).toContain('Root Content');
      expect(result.error).toContain('1 pages failed to export');
    }, 30000); // Increased timeout due to 3s wait per export and retry logic

    it('should handle discovery errors', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      const result = await service.exportNestedPages(testPageInfo, {
        includeNested: true,
        depth: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    it('should call progress callback during export', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const mockRootPage: Page = {
        id: 'page-root',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root',
        name: 'Root',
        browserLink: 'https://coda.io/d/doc-123/_sroot',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage.mockResolvedValue(mockRootPage);
      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root/export/export-123',
        downloadLink: 'https://s3.aws.com/export.md',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Content',
      });

      const progressStates: string[] = [];
      const onProgress = jest.fn((progress) => {
        progressStates.push(progress.state);
      });

      await service.exportNestedPages(
        testPageInfo,
        { includeNested: false, depth: 0 },
        onProgress
      );

      expect(progressStates).toContain('discovering');
      expect(progressStates).toContain('exporting');
      expect(progressStates).toContain('combining');
      expect(progressStates).toContain('complete');
    });
  });
});

