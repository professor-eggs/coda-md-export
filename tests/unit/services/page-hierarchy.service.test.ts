/**
 * Unit tests for PageHierarchyService
 */

import { PageHierarchyService } from '../../../src/domain/services/page-hierarchy.service';
import { ApiClientPort } from '../../../src/domain/ports/api-client.port';
import { StoragePort } from '../../../src/domain/ports/storage.port';
import { CodaPageIdentifier, Page } from '../../../src/domain/models/api.schema';
import { PageHierarchyNode } from '../../../src/domain/models/nested-export.schema';

describe('PageHierarchyService', () => {
  let service: PageHierarchyService;
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

    service = new PageHierarchyService(mockApiClient, mockStorage);
  });

  describe('discoverPages', () => {
    it('should discover single page with no children (depth 0)', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      const mockPage: Page = {
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

      mockApiClient.getPage.mockResolvedValue(mockPage);

      const result = await service.discoverPages(testPageInfo, 0);

      expect(result.totalPages).toBe(1);
      expect(result.maxDepth).toBe(0);
      expect(result.byDepth).toEqual({ '0': 1 });
      expect(result.hierarchy.name).toBe('Root Page');
      expect(result.hierarchy.children).toEqual([]);
    });

    it('should discover pages at depth 1', async () => {
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
        children: [
          {
            id: 'page-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
            name: 'Child 1',
            browserLink: 'https://coda.io/d/doc-123/_s1',
          },
          {
            id: 'page-2',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-2',
            name: 'Child 2',
            browserLink: 'https://coda.io/d/doc-123/_s2',
          },
        ],
      };

      const mockChild1: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child 1',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      const mockChild2: Page = {
        id: 'page-2',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-2',
        name: 'Child 2',
        browserLink: 'https://coda.io/d/doc-123/_s2',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild1)
        .mockResolvedValueOnce(mockChild2);

      const result = await service.discoverPages(testPageInfo, 1);

      expect(result.totalPages).toBe(3);
      expect(result.maxDepth).toBe(1);
      expect(result.byDepth).toEqual({ '0': 1, '1': 2 });
      expect(result.hierarchy.children).toHaveLength(2);
      expect(result.hierarchy.children[0]?.name).toBe('Child 1');
      expect(result.hierarchy.children[1]?.name).toBe('Child 2');
    });

    it('should discover deeply nested pages', async () => {
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
            name: 'Child 1',
            browserLink: 'https://coda.io/d/doc-123/_s1',
          },
        ],
      };

      const mockChild1: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child 1',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [
          {
            id: 'page-1-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
            name: 'Grandchild',
            browserLink: 'https://coda.io/d/doc-123/_s11',
          },
        ],
      };

      const mockGrandchild: Page = {
        id: 'page-1-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
        name: 'Grandchild',
        browserLink: 'https://coda.io/d/doc-123/_s11',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild1)
        .mockResolvedValueOnce(mockGrandchild);

      const result = await service.discoverPages(testPageInfo, 2);

      expect(result.totalPages).toBe(3);
      expect(result.maxDepth).toBe(2);
      expect(result.byDepth).toEqual({ '0': 1, '1': 1, '2': 1 });
      // Check deep nesting
      expect(result.hierarchy.children).toHaveLength(1);
      const firstChild = result.hierarchy.children[0] as PageHierarchyNode;
      expect(firstChild).toBeDefined();
      expect(firstChild.children).toHaveLength(1);
      expect((firstChild.children[0] as PageHierarchyNode).name).toBe('Grandchild');
    });

    it('should respect max depth limit', async () => {
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
            name: 'Child 1',
            browserLink: 'https://coda.io/d/doc-123/_s1',
          },
        ],
      };

      const mockChild1: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child 1',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [
          {
            id: 'page-1-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
            name: 'Grandchild (should not be fetched)',
            browserLink: 'https://coda.io/d/doc-123/_s11',
          },
        ],
      };

      mockApiClient.getPage
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild1);

      // Max depth 1 = root + 1 level of children
      const result = await service.discoverPages(testPageInfo, 1);

      expect(result.totalPages).toBe(2);
      expect(result.maxDepth).toBe(1);
      expect(result.byDepth).toEqual({ '0': 1, '1': 1 });
      // Should not have called getPage for grandchild
      expect(mockApiClient.getPage).toHaveBeenCalledTimes(2);
    });

    it('should handle unlimited depth', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      // Create a 3-level hierarchy
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
        children: [
          {
            id: 'page-1-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
            name: 'Grandchild',
            browserLink: 'https://coda.io/d/doc-123/_s11',
          },
        ],
      };

      const mockGrandchild: Page = {
        id: 'page-1-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
        name: 'Grandchild',
        browserLink: 'https://coda.io/d/doc-123/_s11',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockApiClient.getPage
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild)
        .mockResolvedValueOnce(mockGrandchild);

      const result = await service.discoverPages(testPageInfo, 'unlimited');

      expect(result.totalPages).toBe(3);
      expect(result.maxDepth).toBe(2);
    });

    it('should handle circular references gracefully', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      // Simulate circular reference (should not happen in real API, but we handle it)
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

      // Child references root (circular)
      const mockChild: Page = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'Child',
        browserLink: 'https://coda.io/d/doc-123/_s1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [
          {
            id: 'page-root', // Circular reference!
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-root',
            name: 'Root',
            browserLink: 'https://coda.io/d/doc-123/_sroot',
          },
        ],
      };

      mockApiClient.getPage
        .mockResolvedValueOnce(mockRootPage)
        .mockResolvedValueOnce(mockChild);

      const result = await service.discoverPages(testPageInfo, 'unlimited');

      // Should not enter infinite loop
      expect(result.totalPages).toBe(3); // Root + Child + Circular reference marker
      expect(mockApiClient.getPage).toHaveBeenCalledTimes(2);
    });

    it('should throw error if API key not configured', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      await expect(service.discoverPages(testPageInfo, 1)).rejects.toThrow(
        'API key not configured'
      );
    });
  });

  describe('getFlatPageList', () => {
    it('should return flat list in breadth-first order', () => {
      const hierarchy = {
        pageId: 'root',
        docId: 'doc-123',
        name: 'Root',
        depth: 0,
        path: '0',
        children: [
          {
            pageId: 'child-1',
            docId: 'doc-123',
            name: 'Child 1',
            depth: 1,
            path: '0.1',
            children: [
              {
                pageId: 'grandchild-1',
                docId: 'doc-123',
                name: 'Grandchild 1',
                depth: 2,
                path: '0.1.1',
                children: [],
              },
            ],
          },
          {
            pageId: 'child-2',
            docId: 'doc-123',
            name: 'Child 2',
            depth: 1,
            path: '0.2',
            children: [],
          },
        ],
      };

      const result = service.getFlatPageList(hierarchy);

      expect(result).toHaveLength(4);
      expect(result[0]?.name).toBe('Root');
      expect(result[1]?.name).toBe('Child 1');
      expect(result[2]?.name).toBe('Child 2');
      expect(result[3]?.name).toBe('Grandchild 1');
    });
  });

  describe('getPagesByDepth', () => {
    it('should group pages by depth level', () => {
      const hierarchy = {
        pageId: 'root',
        docId: 'doc-123',
        name: 'Root',
        depth: 0,
        path: '0',
        children: [
          {
            pageId: 'child-1',
            docId: 'doc-123',
            name: 'Child 1',
            depth: 1,
            path: '0.1',
            children: [],
          },
          {
            pageId: 'child-2',
            docId: 'doc-123',
            name: 'Child 2',
            depth: 1,
            path: '0.2',
            children: [],
          },
        ],
      };

      const result = service.getPagesByDepth(hierarchy);

      expect(result.size).toBe(2);
      expect(result.get(0)).toHaveLength(1);
      expect(result.get(0)?.[0]?.name).toBe('Root');
      expect(result.get(1)).toHaveLength(2);
      expect(result.get(1)?.[0]?.name).toBe('Child 1');
      expect(result.get(1)?.[1]?.name).toBe('Child 2');
    });
  });
});

