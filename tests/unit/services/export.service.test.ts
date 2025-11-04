/**
 * Unit tests for ExportService
 */

import { ExportService } from '../../../src/domain/services/export.service';
import { ApiClientPort } from '../../../src/domain/ports/api-client.port';
import { StoragePort } from '../../../src/domain/ports/storage.port';
import { CodaPageIdentifier } from '../../../src/domain/models/api.schema';

// Mock chrome.downloads API and URL methods
global.chrome = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloads: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch
global.fetch = jest.fn();

describe('ExportService', () => {
  let service: ExportService;
  let mockApiClient: jest.Mocked<ApiClientPort>;
  let mockStorage: jest.Mocked<StoragePort>;
  let mockDownloads: { download: jest.Mock };

  const testPageInfo: CodaPageIdentifier = {
    docId: 'Test-Doc_dABC123',
    pageId: 'p456',
  };

  beforeEach(() => {
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

    mockDownloads = {
      download: jest.fn().mockImplementation((_options, callback) => {
        // Simulate successful download
        if (callback) callback(1);
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.chrome.downloads as any) = mockDownloads;

    // Clear fetch mocks
    (global.fetch as jest.Mock).mockClear();

    // Use short poll interval for tests (10ms instead of 2000ms)
    service = new ExportService(mockApiClient, mockStorage, 10, 60);
  });

  describe('exportPage', () => {
    it('should successfully export and download a page', async () => {
      // Setup
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/api/export/123',
        downloadLink: 'https://coda.io/download/file.md',
      });

      // Mock fetch for content retrieval
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '# Test Content',
      });

      const progressStates: string[] = [];
      const onProgress = jest.fn((progress) => {
        progressStates.push(progress.state);
      });

      // Execute
      const result = await service.exportPage(testPageInfo, onProgress);

      // Assert
      expect(result.success).toBe(true);
      expect(result.state).toBe('complete');
      expect(result.exportId).toBe('export-123');
      // Filename is generated from pageId now
      expect(result.fileName).toMatch(/page-p456-\d{4}-\d{2}-\d{2}\.md/);

      // Verify progress callback was called
      expect(progressStates).toContain('starting');
      expect(progressStates).toContain('exporting');
      expect(progressStates).toContain('polling');
      expect(progressStates).toContain('downloading');
      expect(progressStates).toContain('complete');

      // Verify API calls
      expect(mockApiClient.beginPageExport).toHaveBeenCalledWith(
        'test-api-key',
        'Test-Doc_dABC123',
        'p456',
        { outputFormat: 'markdown' }
      );

      expect(mockApiClient.getExportStatus).toHaveBeenCalledWith(
        'test-api-key',
        'Test-Doc_dABC123',
        'p456',
        'export-123'
      );

      // Fetch is used instead of downloadExport
      expect(global.fetch).toHaveBeenCalledWith('https://coda.io/download/file.md');

      expect(mockDownloads.download).toHaveBeenCalled();
    });

    it('should fail if API key is not configured', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: false,
      });

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(false);
      expect(result.state).toBe('failed');
      expect(result.error).toBe('API key not configured');
    });

    it('should handle export initiation failure', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockRejectedValue(new Error('API error'));

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(false);
      expect(result.state).toBe('failed');
      expect(result.error).toContain('API error');
    });

    it('should handle failed export status', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'failed',
        href: 'https://coda.io/api/export/123',
        error: 'Export processing failed',
      });

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(false);
      expect(result.state).toBe('failed');
      expect(result.error).toContain('Export processing failed');
    });

    it('should handle missing download URL', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/api/export/123',
        // Missing downloadLink
      });

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no download link provided');
    });

    it('should handle download failure', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/api/export/123',
        downloadLink: 'https://coda.io/download/file.md',
      });

      // Mock fetch to simulate download failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch content');
    });

    it('should poll multiple times before completion', async () => {
      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      // Return inProgress twice, then complete
      mockApiClient.getExportStatus
        .mockResolvedValueOnce({
          id: 'export-123',
          status: 'inProgress',
          href: 'https://coda.io/api/export/123',
        })
        .mockResolvedValueOnce({
          id: 'export-123',
          status: 'inProgress',
          href: 'https://coda.io/api/export/123',
        })
        .mockResolvedValueOnce({
          id: 'export-123',
          status: 'complete',
          href: 'https://coda.io/api/export/123',
          downloadLink: 'https://coda.io/download/file.md',
        });

      // Mock fetch for content retrieval
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '# Test Content',
      });

      const result = await service.exportPage(testPageInfo);

      expect(result.success).toBe(true);
      expect(mockApiClient.getExportStatus).toHaveBeenCalledTimes(3);
    });

    it('should generate correct filename from page info', async () => {
      const pageInfo = {
        docId: 'My-Cool-Project_dXYZ789',
        pageId: 'p123',
      };

      mockStorage.getConfiguration.mockResolvedValue({
        isConfigured: true,
        apiKey: 'test-api-key',
      });

      mockApiClient.beginPageExport.mockResolvedValue({
        id: 'export-123',
        status: 'inProgress',
        href: 'https://coda.io/api/export/123',
      });

      mockApiClient.getExportStatus.mockResolvedValue({
        id: 'export-123',
        status: 'complete',
        href: 'https://coda.io/api/export/123',
        downloadLink: 'https://coda.io/download/file.md',
      });

      // Mock fetch for content retrieval
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '# Test Content',
      });

      const result = await service.exportPage(pageInfo);

      // Filename is generated from pageId, not docId
      expect(result.fileName).toMatch(/page-p123-\d{4}-\d{2}-\d{2}\.md/);
    });
  });
});
