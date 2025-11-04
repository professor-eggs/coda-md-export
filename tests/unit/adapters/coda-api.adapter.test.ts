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
});
