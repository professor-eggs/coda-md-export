/**
 * Unit tests for CodaApiAdapter
 */

import { CodaApiAdapter, CodaApiError } from '../../../src/adapters/api/coda-api.adapter';
import { BeginPageContentExportRequest } from '../../../src/domain/models/api.schema';

// Mock fetch globally
global.fetch = jest.fn();

describe('CodaApiAdapter', () => {
  let adapter: CodaApiAdapter;
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    adapter = new CodaApiAdapter();
    mockFetch.mockClear();
  });

  describe('whoami', () => {
    it('should successfully call whoami endpoint', async () => {
      const mockUser = {
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await adapter.whoami('test-api-key');

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/whoami',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw CodaApiError on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: 'Invalid API key',
        }),
      });

      await expect(adapter.whoami('invalid-key')).rejects.toThrow(CodaApiError);

      // Reset mock for second call
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          statusMessage: 'Unauthorized',
          message: 'Invalid API key',
        }),
      });

      await expect(adapter.whoami('invalid-key')).rejects.toThrow('Invalid API key');
    });

    it('should throw CodaApiError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.whoami('test-api-key')).rejects.toThrow('Network error');
    });

    it('should throw error when response does not match schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      await expect(adapter.whoami('test-api-key')).rejects.toThrow();
    });
  });

  describe('beginPageExport', () => {
    it('should successfully begin page export', async () => {
      const mockResponse = {
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-456/export/export-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: BeginPageContentExportRequest = {
        outputFormat: 'markdown',
      };

      const result = await adapter.beginPageExport('test-api-key', 'doc-123', 'page-456', request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc-123/pages/page-456/export',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
          body: JSON.stringify(request),
        })
      );
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: 'Page not found',
        }),
      });

      const request: BeginPageContentExportRequest = {
        outputFormat: 'markdown',
      };

      await expect(
        adapter.beginPageExport('test-api-key', 'invalid-doc', 'invalid-page', request)
      ).rejects.toThrow('Page not found');
    });

    it('should properly encode URL parameters', async () => {
      const mockResponse = {
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/apis/v1/docs/doc%20with%20spaces/pages/page%20456/export/export-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: BeginPageContentExportRequest = {
        outputFormat: 'markdown',
      };

      await adapter.beginPageExport('test-api-key', 'doc with spaces', 'page 456', request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc%20with%20spaces/pages/page%20456/export',
        expect.any(Object)
      );
    });
  });

  describe('getExportStatus', () => {
    it('should successfully get export status', async () => {
      const mockResponse = {
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-456/export/export-123',
        downloadLink: 'https://coda.io/download/export-123.md',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getExportStatus(
        'test-api-key',
        'doc-123',
        'page-456',
        'export-123'
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc-123/pages/page-456/export/export-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle failed export status', async () => {
      const mockResponse = {
        id: 'export-123',
        status: 'failed',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-456/export/export-123',
        error: 'Export failed due to timeout',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.getExportStatus(
        'test-api-key',
        'doc-123',
        'page-456',
        'export-123'
      );

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Export failed due to timeout');
    });
  });

  describe('downloadExport', () => {
    it('should successfully download export', async () => {
      const mockBlob = new Blob(['# Test Content'], { type: 'text/markdown' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await adapter.downloadExport('https://coda.io/download/export-123.md');

      expect(result).toBe(mockBlob);
    });

    it('should throw error on download failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(
        adapter.downloadExport('https://coda.io/download/export-123.md')
      ).rejects.toThrow('Failed to download export');
    });
  });

  describe('listPages', () => {
    it('should successfully list pages in a document', async () => {
      const mockPageList = {
        items: [
          {
            id: 'page-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
            name: 'Page 1',
            browserLink: 'https://coda.io/d/doc-123/_spage1',
          },
          {
            id: 'page-2',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-2',
            name: 'Page 2',
            browserLink: 'https://coda.io/d/doc-123/_spage2',
          },
        ],
        href: 'https://coda.io/apis/v1/docs/doc-123/pages',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageList,
      });

      const result = await adapter.listPages('test-api-key', 'doc-123');

      expect(result).toEqual(mockPageList);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc-123/pages',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle URL encoding for doc ID', async () => {
      const mockPageList = {
        items: [],
        href: 'https://coda.io/apis/v1/docs/My-Doc_d123/pages',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageList,
      });

      await adapter.listPages('test-api-key', 'My-Doc_d123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/My-Doc_d123/pages',
        expect.any(Object)
      );
    });

    it('should throw CodaApiError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: 'Document not found',
        }),
      });

      await expect(adapter.listPages('test-api-key', 'invalid-doc')).rejects.toThrow(
        CodaApiError
      );
    });
  });

  describe('getPage', () => {
    it('should successfully get page details', async () => {
      const mockPage = {
        id: 'page-1',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        name: 'My Page',
        browserLink: 'https://coda.io/d/doc-123/_spage1',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        parent: {
          id: 'page-0',
          type: 'page',
          href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-0',
          name: 'Parent Page',
        },
        children: [
          {
            id: 'page-1-1',
            type: 'page',
            href: 'https://coda.io/apis/v1/docs/doc-123/pages/page-1-1',
            name: 'Child Page',
            browserLink: 'https://coda.io/d/doc-123/_spage11',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage,
      });

      const result = await adapter.getPage('test-api-key', 'doc-123', 'page-1');

      expect(result).toEqual(mockPage);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc-123/pages/page-1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle URL encoding for page ID', async () => {
      const mockPage = {
        id: 'canvas-abc',
        type: 'page',
        href: 'https://coda.io/apis/v1/docs/doc-123/pages/canvas-abc',
        name: 'My Page',
        browserLink: 'https://coda.io/d/doc-123/_sabc',
        contentType: 'canvas',
        isHidden: false,
        isEffectivelyHidden: false,
        children: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage,
      });

      await adapter.getPage('test-api-key', 'doc-123', 'canvas-abc');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://coda.io/apis/v1/docs/doc-123/pages/canvas-abc',
        expect.any(Object)
      );
    });

    it('should throw CodaApiError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: 'Page not found',
        }),
      });

      await expect(adapter.getPage('test-api-key', 'doc-123', 'invalid-page')).rejects.toThrow(
        CodaApiError
      );
    });

    it('should validate response schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      await expect(adapter.getPage('test-api-key', 'doc-123', 'page-1')).rejects.toThrow();
    });
  });
});
