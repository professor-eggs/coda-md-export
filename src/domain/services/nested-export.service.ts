/**
 * Nested Export Service - exports multiple nested pages and combines them
 */

import { ApiClientPort } from '../ports/api-client.port';
import { StoragePort } from '../ports/storage.port';
import { CodaPageIdentifier } from '../models/api.schema';
import {
  PageHierarchyNode,
  NestedExportSettings,
  CombinedExportResult,
  NestedExportProgress,
  FailedPageExport,
} from '../models/nested-export.schema';
import { PageHierarchyService } from './page-hierarchy.service';

export class NestedExportService {
  private readonly hierarchyService: PageHierarchyService;

  constructor(
    private readonly apiClient: ApiClientPort,
    private readonly storage: StoragePort
  ) {
    this.hierarchyService = new PageHierarchyService(apiClient, storage);
  }

  /**
   * Export all pages in a hierarchy and combine into single document
   */
  async exportNestedPages(
    pageInfo: CodaPageIdentifier,
    settings: NestedExportSettings,
    onProgress?: (progress: NestedExportProgress) => void
  ): Promise<CombinedExportResult> {
    try {
      // Step 1: Discover pages
      onProgress?.({
        state: 'discovering',
        message: 'Discovering nested pages...',
      });

      const pageCount = await this.hierarchyService.discoverPages(pageInfo, settings.depth);

      onProgress?.({
        state: 'discovering',
        message: `Found ${pageCount.totalPages} pages`,
        totalPages: pageCount.totalPages,
      });

      // Step 2: Export pages by depth level
      onProgress?.({
        state: 'exporting',
        message: 'Exporting pages...',
        pagesProcessed: 0,
        totalPages: pageCount.totalPages,
      });

      const exportResults = await this.exportPagesByDepth(
        pageCount.hierarchy,
        (processed) => {
          onProgress?.({
            state: 'exporting',
            message: `Exported ${processed} of ${pageCount.totalPages} pages`,
            pagesProcessed: processed,
            totalPages: pageCount.totalPages,
          });
        }
      );

      // Step 3: Combine content
      onProgress?.({
        state: 'combining',
        message: 'Combining content...',
        pagesProcessed: exportResults.successful.size,
        totalPages: pageCount.totalPages,
      });

      const combinedContent = this.combineExportedPages(
        exportResults.successful,
        pageCount.hierarchy
      );

      onProgress?.({
        state: 'complete',
        message: 'Export complete!',
        pagesProcessed: exportResults.successful.size,
        totalPages: pageCount.totalPages,
      });

      return {
        success: exportResults.failed.length === 0,
        totalPages: pageCount.totalPages,
        successfulPages: exportResults.successful.size,
        failedPages: exportResults.failed,
        combinedContent,
        error: exportResults.failed.length > 0
          ? `${exportResults.failed.length} pages failed to export`
          : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        totalPages: 0,
        successfulPages: 0,
        failedPages: [],
        combinedContent: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Export pages level by level (depth-first)
   */
  private async exportPagesByDepth(
    hierarchy: PageHierarchyNode,
    onProgress?: (processed: number) => void
  ): Promise<{
    successful: Map<string, string>; // pageId -> content
    failed: FailedPageExport[];
  }> {
    const successful = new Map<string, string>();
    const failed: FailedPageExport[] = [];

    // Group pages by depth
    const pagesByDepth = this.hierarchyService.getPagesByDepth(hierarchy);

    // Process each depth level sequentially
    let totalProcessed = 0;
    for (const [, pagesAtDepth] of Array.from(pagesByDepth.entries()).sort(
      ([a], [b]) => a - b
    )) {
      // Export pages with limited concurrency (max 3 at a time)
      await this.exportPagesInBatches(pagesAtDepth, 3, successful, failed);
      
      totalProcessed += pagesAtDepth.length;
      onProgress?.(totalProcessed);
    }

    return { successful, failed };
  }

  /**
   * Export pages in batches to limit concurrency
   */
  private async exportPagesInBatches(
    pages: PageHierarchyNode[],
    batchSize: number,
    successful: Map<string, string>,
    failed: FailedPageExport[]
  ): Promise<void> {
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      
      const exportPromises = batch.map(async (page) => {
        try {
          const content = await this.exportSinglePage(page);
          successful.set(page.pageId, content);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({
            pageId: page.pageId,
            pageName: page.name,
            path: page.path,
            error: errorMessage,
          });
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.all(exportPromises);
    }
  }

  /**
   * Export a single page and return its content
   */
  private async exportSinglePage(page: PageHierarchyNode): Promise<string> {
    const config = await this.storage.getConfiguration();
    if (!config.isConfigured || !config.apiKey) {
      throw new Error('API key not configured');
    }

    // Begin export with retry
    const exportResponse = await this.retryOperation(
      () =>
        this.apiClient.beginPageExport(config.apiKey!, page.docId, page.pageId, {
          outputFormat: 'markdown',
        }),
      3,
      1000
    );

    // Wait 3 seconds before polling (Coda API needs time to register export)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
    const pollInterval = 2000;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const status = await this.apiClient.getExportStatus(
          config.apiKey!,
          page.docId,
          page.pageId,
          exportResponse.id
        );

        if (status.status === 'complete') {
          if (!status.downloadLink) {
            throw new Error('Export completed but no download link provided');
          }

          // Fetch content with retry
          const content = await this.retryOperation(async () => {
            const response = await fetch(status.downloadLink!);
            if (!response.ok) {
              throw new Error(`Failed to fetch content: ${response.status}`);
            }
            return await response.text();
          }, 3, 1000);

          return content;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Export failed');
        }

        // Still in progress, wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        // If this is the last attempt, throw the error
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Otherwise, wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Export timed out after ${maxAttempts} attempts`);
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: delay = baseDelay * 2^attempt
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Combine exported page content into a single document
   */
  private combineExportedPages(
    exportedPages: Map<string, string>,
    hierarchy: PageHierarchyNode
  ): string {
    const parts: string[] = [];

    // Traverse hierarchy in order and add content with separators
    const traverse = (node: PageHierarchyNode) => {
      const content = exportedPages.get(node.pageId);
      if (content) {
        // Add separator with page info
        const separator = `\n\n${'='.repeat(80)}\n` +
          `Page: ${node.name}\n` +
          `Path: ${node.path}\n` +
          `Depth: ${node.depth}\n` +
          `${'='.repeat(80)}\n\n`;

        parts.push(separator);
        parts.push(content);
      }

      // Recursively process children
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(hierarchy);

    return parts.join('');
  }
}

