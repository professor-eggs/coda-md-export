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
      // Export all pages at this depth in parallel
      const exportPromises = pagesAtDepth.map(async (page) => {
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

      await Promise.all(exportPromises);
      totalProcessed += pagesAtDepth.length;
      onProgress?.(totalProcessed);
    }

    return { successful, failed };
  }

  /**
   * Export a single page and return its content
   */
  private async exportSinglePage(page: PageHierarchyNode): Promise<string> {
    const config = await this.storage.getConfiguration();
    if (!config.isConfigured || !config.apiKey) {
      throw new Error('API key not configured');
    }

    // Begin export
    const exportResponse = await this.apiClient.beginPageExport(
      config.apiKey,
      page.docId,
      page.pageId,
      { outputFormat: 'markdown' }
    );

    // Wait a bit before polling
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      attempts++;
      const status = await this.apiClient.getExportStatus(
        config.apiKey,
        page.docId,
        page.pageId,
        exportResponse.id
      );

      if (status.status === 'complete') {
        if (!status.downloadLink) {
          throw new Error('Export completed but no download link provided');
        }

        // Fetch content
        const response = await fetch(status.downloadLink);
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`);
        }

        return await response.text();
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Export failed');
      }

      // Still in progress, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Export timed out');
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

