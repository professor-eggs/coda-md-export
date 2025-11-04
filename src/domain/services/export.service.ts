/**
 * Export Service - domain service for exporting pages as Markdown
 */

import { ApiClientPort } from '../ports/api-client.port';
import { StoragePort } from '../ports/storage.port';
import { CodaPageIdentifier } from '../models/api.schema';
import { ExportResult, ExportProgress } from '../models/export.schema';

interface CachedExport {
  downloadUrl: string;
  exportId: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export class ExportService {
  private readonly pollInterval: number;
  private readonly maxPollAttempts: number;
  private readonly exportCache: Map<string, CachedExport>;
  private readonly defaultCacheDuration: number = 5 * 60 * 1000; // 5 minutes in ms

  constructor(
    private readonly apiClient: ApiClientPort,
    private readonly storage: StoragePort,
    pollInterval: number = 2000, // Poll every 2 seconds by default
    maxPollAttempts: number = 60 // Max 2 minutes (60 * 2s) by default
  ) {
    this.pollInterval = pollInterval;
    this.maxPollAttempts = maxPollAttempts;
    this.exportCache = new Map();
  }

  /**
   * Export a page and download it
   */
  async exportPage(
    pageInfo: CodaPageIdentifier,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    try {
      const config = await this.storage.getConfiguration();
      if (!config.isConfigured || !config.apiKey) {
        return {
          success: false,
          state: 'failed',
          error: 'API key not configured',
        };
      }

      // Check cache first
      const cached = this.getCachedExport(pageInfo);
      let downloadUrl: string;
      let exportId: string;

      if (cached) {
        console.log('[ExportService] Using cached export:', {
          exportId: cached.exportId,
          expiresAt: new Date(cached.expiresAt).toISOString(),
        });
        downloadUrl = cached.downloadUrl;
        exportId = cached.exportId;

        onProgress?.({
          state: 'downloading',
          message: 'Using cached export...',
          exportId,
          pageInfo,
        });
      } else {
        // Step 1: Begin export
        exportId = await this.beginExport(config.apiKey, pageInfo, onProgress);

        // Step 2: Poll until complete
        downloadUrl = await this.pollUntilComplete(config.apiKey, pageInfo, exportId, onProgress);

        // Cache the result
        this.cacheExport(pageInfo, exportId, downloadUrl);
      }

      // Step 3: Fetch content
      onProgress?.({
        state: 'downloading',
        message: 'Downloading file...',
        exportId,
        pageInfo,
      });

      const content = await this.fetchContent(downloadUrl);

      // Step 4: Download file
      const fileName = this.generateFileName(pageInfo);
      await this.downloadFileFromContent(content, fileName);

      onProgress?.({
        state: 'complete',
        message: 'Export complete!',
        exportId,
        pageInfo,
      });

      return {
        success: true,
        state: 'complete',
        exportId,
        fileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ExportService] Export failed:', error);
      return {
        success: false,
        state: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Export a page and copy to clipboard
   */
  async exportToClipboard(
    pageInfo: CodaPageIdentifier,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    try {
      const config = await this.storage.getConfiguration();
      if (!config.isConfigured || !config.apiKey) {
        return {
          success: false,
          state: 'failed',
          error: 'API key not configured',
        };
      }

      // Check cache first
      const cached = this.getCachedExport(pageInfo);
      let downloadUrl: string;
      let exportId: string;

      if (cached) {
        console.log('[ExportService] Using cached export:', {
          exportId: cached.exportId,
          expiresAt: new Date(cached.expiresAt).toISOString(),
        });
        downloadUrl = cached.downloadUrl;
        exportId = cached.exportId;

        onProgress?.({
          state: 'downloading',
          message: 'Using cached export...',
          exportId,
          pageInfo,
        });
      } else {
        // Step 1: Begin export
        exportId = await this.beginExport(config.apiKey, pageInfo, onProgress);

        // Step 2: Poll until complete
        downloadUrl = await this.pollUntilComplete(config.apiKey, pageInfo, exportId, onProgress);

        // Cache the result
        this.cacheExport(pageInfo, exportId, downloadUrl);
      }

      // Step 3: Fetch content
      onProgress?.({
        state: 'downloading',
        message: 'Fetching content...',
        exportId,
        pageInfo,
      });

      const content = await this.fetchContent(downloadUrl);

      // Step 4: Copy to clipboard
      await this.copyContentToClipboard(content);

      onProgress?.({
        state: 'complete',
        message: 'Copied to clipboard!',
        exportId,
        pageInfo,
      });

      return {
        success: true,
        state: 'complete',
        exportId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ExportService] Copy to clipboard failed:', error);
      return {
        success: false,
        state: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Get cache key for a page
   */
  private getCacheKey(pageInfo: CodaPageIdentifier): string {
    return `${pageInfo.docId}:${pageInfo.pageId}`;
  }

  /**
   * Get cached export if still valid
   */
  private getCachedExport(pageInfo: CodaPageIdentifier): CachedExport | null {
    const key = this.getCacheKey(pageInfo);
    const cached = this.exportCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() >= cached.expiresAt) {
      console.log('[ExportService] Cache expired for:', key);
      this.exportCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache an export result
   */
  private cacheExport(pageInfo: CodaPageIdentifier, exportId: string, downloadUrl: string): void {
    const key = this.getCacheKey(pageInfo);

    // Extract expiration from AWS URL
    const expiresIn = this.extractAwsExpiration(downloadUrl);
    const expiresAt = Date.now() + expiresIn;

    console.log('[ExportService] Caching export:', {
      key,
      exportId,
      expiresIn: `${expiresIn / 1000}s`,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    this.exportCache.set(key, {
      downloadUrl,
      exportId,
      expiresAt,
    });
  }

  /**
   * Extract X-Amz-Expires from AWS S3 URL, default to 5 minutes
   */
  private extractAwsExpiration(url: string): number {
    try {
      const urlObj = new URL(url);
      const expiresParam = urlObj.searchParams.get('X-Amz-Expires');

      if (expiresParam) {
        const expiresSeconds = parseInt(expiresParam, 10);
        if (!isNaN(expiresSeconds) && expiresSeconds > 0) {
          // Convert to milliseconds
          const expiresMs = expiresSeconds * 1000;
          console.log('[ExportService] Extracted AWS expiration:', `${expiresSeconds}s`);
          return expiresMs;
        }
      }
    } catch (error) {
      console.warn('[ExportService] Failed to parse AWS expiration:', error);
    }

    // Default to 5 minutes
    console.log('[ExportService] Using default cache duration: 5 minutes');
    return this.defaultCacheDuration;
  }

  /**
   * Step 1: Begin export request and return export ID
   */
  private async beginExport(
    apiKey: string,
    pageInfo: CodaPageIdentifier,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    onProgress?.({
      state: 'starting',
      message: 'Initiating export...',
      pageInfo,
    });

    console.log('[ExportService] Beginning export for:', {
      docId: pageInfo.docId,
      pageId: pageInfo.pageId,
    });

    try {
      const exportResponse = await this.apiClient.beginPageExport(
        apiKey,
        pageInfo.docId,
        pageInfo.pageId,
        { outputFormat: 'markdown' }
      );

      const exportId = exportResponse.id;
      console.log('[ExportService] Export initiated:', {
        exportId,
        status: exportResponse.status,
      });

      onProgress?.({
        state: 'exporting',
        message: 'Export started, waiting for completion...',
        exportId,
        pageInfo,
      });

      // Critical: Wait 3 seconds before polling
      // The Coda API needs time to register the export request
      console.log('[ExportService] Waiting 3 seconds before first poll...');
      await this.sleep(3000);

      return exportId;
    } catch (error) {
      console.error('[ExportService] Failed to begin export:', error);
      throw new Error(
        `Failed to start export: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Step 2: Poll export status until complete, return download URL
   */
  private async pollUntilComplete(
    apiKey: string,
    pageInfo: CodaPageIdentifier,
    exportId: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    let attempts = 0;

    console.log('[ExportService] Starting poll loop:', {
      exportId,
      maxAttempts: this.maxPollAttempts,
      interval: this.pollInterval,
    });

    while (attempts < this.maxPollAttempts) {
      attempts++;

      onProgress?.({
        state: 'polling',
        message: `Checking export status (${attempts}/${this.maxPollAttempts})...`,
        exportId,
        pageInfo,
      });

      try {
        console.log(`[ExportService] Poll attempt ${attempts}/${this.maxPollAttempts}`);

        const status = await this.apiClient.getExportStatus(
          apiKey,
          pageInfo.docId,
          pageInfo.pageId,
          exportId
        );

        console.log('[ExportService] Status response:', {
          status: status.status,
          hasDownloadLink: !!status.downloadLink,
        });

        if (status.status === 'complete') {
          if (!status.downloadLink) {
            throw new Error('Export completed but no download link provided');
          }
          console.log('[ExportService] Export complete! Download URL received');
          return status.downloadLink;
        }

        if (status.status === 'failed') {
          const error = status.error ?? 'Export failed';
          console.error('[ExportService] Export failed:', error);
          throw new Error(error);
        }

        // Still in progress
        console.log(`[ExportService] Still in progress, waiting ${this.pollInterval}ms...`);
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error('[ExportService] Error during status check:', error);
        throw new Error(
          `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.error('[ExportService] Export timed out after', attempts, 'attempts');
    throw new Error('Export timed out');
  }

  /**
   * Step 3: Fetch content from download URL, return as string
   */
  private async fetchContent(url: string): Promise<string> {
    console.log('[ExportService] Fetching content from URL');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error('[ExportService] Fetch failed:', {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      console.log('[ExportService] Content fetched successfully:', {
        length: content.length,
        preview: content.substring(0, 100),
      });

      return content;
    } catch (error) {
      console.error('[ExportService] Error fetching content:', error);
      throw new Error(
        `Failed to fetch content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Step 4a: Download file from content string
   */
  private async downloadFileFromContent(content: string, fileName: string): Promise<void> {
    console.log('[ExportService] Creating download:', {
      fileName,
      contentLength: content.length,
    });

    try {
      // Create a blob and data URL from the content
      const blob = new Blob([content], { type: 'text/markdown' });
      const dataUrl = URL.createObjectURL(blob);

      // Use Chrome downloads API to download
      await new Promise<void>((resolve, reject) => {
        chrome.downloads.download(
          {
            url: dataUrl,
            filename: fileName,
            saveAs: true,
          },
          (downloadId) => {
            // Clean up the blob URL after a short delay
            setTimeout(() => URL.revokeObjectURL(dataUrl), 1000);

            if (chrome.runtime.lastError) {
              console.error('[ExportService] Download failed:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log('[ExportService] Download started:', downloadId);
              resolve();
            }
          }
        );
      });
    } catch (error) {
      console.error('[ExportService] Error creating download:', error);
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Step 4b: Copy content string to clipboard
   */
  private async copyContentToClipboard(content: string): Promise<void> {
    console.log('[ExportService] Copying to clipboard:', {
      contentLength: content.length,
    });

    try {
      await navigator.clipboard.writeText(content);
      console.log('[ExportService] Content copied to clipboard successfully');
    } catch (error) {
      console.error('[ExportService] Failed to copy to clipboard:', error);
      throw new Error(
        `Failed to copy to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate filename from page info
   */
  private generateFileName(pageInfo: CodaPageIdentifier): string {
    const pageName = pageInfo.pageId
      .replace(/^canvas-/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const timestamp = new Date().toISOString().split('T')[0];
    return `page-${pageName}-${timestamp}.md`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
