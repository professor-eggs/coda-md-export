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

  // Cache for export job IDs: pageId -> { exportId, submittedAt }
  private readonly exportJobCache = new Map<string, { exportId: string; submittedAt: Date }>();

  // Cache for completed content: pageId -> { content, fetchedAt, pageUpdatedAt }
  private readonly contentCache = new Map<
    string,
    { content: string; fetchedAt: Date; pageUpdatedAt: Date | null }
  >();

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

      // Step 2: Submit all export jobs sequentially, then poll concurrently
      onProgress?.({
        state: 'exporting',
        message: 'Submitting export jobs...',
        pagesProcessed: 0,
        totalPages: pageCount.totalPages,
      });

      const exportResults = await this.exportAllPagesOptimized(
        pageCount.hierarchy,
        pageCount.totalPages,
        (submitted, completed) => {
          if (completed > 0) {
            onProgress?.({
              state: 'exporting',
              message: `Completed ${completed} of ${pageCount.totalPages} pages`,
              pagesProcessed: completed,
              totalPages: pageCount.totalPages,
            });
          } else {
            onProgress?.({
              state: 'exporting',
              message: `Requesting export ${submitted}/${pageCount.totalPages}...`,
              pagesProcessed: submitted,
              totalPages: pageCount.totalPages,
            });
          }
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
        error:
          exportResults.failed.length > 0
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
   * Check if cached content is still valid based on page's updatedAt timestamp
   */
  private isCacheValid(pageId: string, pageUpdatedAt: Date | null): boolean {
    const cached = this.contentCache.get(pageId);
    if (!cached) {
      return false;
    }

    // If page has been updated since we cached it, cache is stale
    if (pageUpdatedAt && cached.pageUpdatedAt) {
      return pageUpdatedAt <= cached.pageUpdatedAt;
    }

    // If we don't have update timestamps, consider cache valid for 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return cached.fetchedAt > fiveMinutesAgo;
  }

  /**
   * Get cached content if valid
   */
  private getCachedContent(pageId: string, pageUpdatedAt: Date | null): string | null {
    if (this.isCacheValid(pageId, pageUpdatedAt)) {
      const cached = this.contentCache.get(pageId);
      return cached?.content || null;
    }
    return null;
  }

  /**
   * Store content in cache
   */
  private setCachedContent(pageId: string, content: string, pageUpdatedAt: Date | null): void {
    this.contentCache.set(pageId, {
      content,
      fetchedAt: new Date(),
      pageUpdatedAt,
    });
  }

  /**
   * Get cached export job ID
   */
  private getCachedJobId(pageId: string): string | null {
    const cached = this.exportJobCache.get(pageId);
    if (!cached) {
      return null;
    }

    // Consider job ID cache valid for 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (cached.submittedAt < tenMinutesAgo) {
      // Job is too old, probably expired
      this.exportJobCache.delete(pageId);
      return null;
    }

    return cached.exportId;
  }

  /**
   * Store export job ID in cache
   */
  private setCachedJobId(pageId: string, exportId: string): void {
    this.exportJobCache.set(pageId, {
      exportId,
      submittedAt: new Date(),
    });
  }

  /**
   * Optimized export: Submit all jobs sequentially, then poll concurrently
   * This avoids overwhelming the API with 45+ concurrent exports at once
   */
  private async exportAllPagesOptimized(
    hierarchy: PageHierarchyNode,
    _totalPages: number,
    onProgress?: (submitted: number, completed: number) => void
  ): Promise<{
    successful: Map<string, string>; // pageId -> content
    failed: FailedPageExport[];
  }> {
    const config = await this.storage.getConfiguration();
    if (!config.isConfigured || !config.apiKey) {
      throw new Error('API key not configured');
    }

    // Get flat list of all pages in hierarchy order
    const allPages = this.hierarchyService.getFlatPageList(hierarchy);

    // Phase 1: Check cache and submit jobs as needed
    type ExportJob = {
      page: PageHierarchyNode;
      exportId: string;
      pageUpdatedAt: Date | null;
    };

    const jobs: ExportJob[] = [];
    const failed: FailedPageExport[] = [];
    const successful = new Map<string, string>();
    let submitted = 0;

    for (const page of allPages) {
      try {
        // Get page details to check updatedAt timestamp
        const pageDetails = await this.apiClient.getPage(config.apiKey!, page.docId, page.pageId);
        const pageUpdatedAt = pageDetails.updatedAt ? new Date(pageDetails.updatedAt) : null;

        // Check if we have cached content (and it's still valid)
        const cachedContent = this.getCachedContent(page.pageId, pageUpdatedAt);
        if (cachedContent) {
          successful.set(page.pageId, cachedContent);
          submitted++;
          onProgress?.(submitted, submitted); // Already complete
          continue;
        }

        // Check if we have a cached job ID
        const cachedJobId = this.getCachedJobId(page.pageId);
        if (cachedJobId) {
          // We already submitted this job, just add to polling queue
          jobs.push({
            page,
            exportId: cachedJobId,
            pageUpdatedAt,
          });
          submitted++;
          onProgress?.(submitted, 0);
          continue;
        }

        // No cache, submit new export job
        const exportResponse = await this.retryOperation(
          () =>
            this.apiClient.beginPageExport(config.apiKey!, page.docId, page.pageId, {
              outputFormat: 'markdown',
            }),
          3,
          1000
        );

        // Cache the job ID
        this.setCachedJobId(page.pageId, exportResponse.id);

        jobs.push({
          page,
          exportId: exportResponse.id,
          pageUpdatedAt,
        });

        submitted++;
        onProgress?.(submitted, 0);
      } catch (error) {
        // If we can't even submit the job, mark as failed immediately
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({
          pageId: page.pageId,
          pageName: page.name,
          path: page.path,
          error: `Failed to submit: ${errorMessage}`,
        });
        submitted++;
        onProgress?.(submitted, 0);
      }
    }

    // Wait 3 seconds before polling (API needs time to register all exports)
    // (Skip if we have no jobs to poll)
    if (jobs.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Phase 2: Poll all jobs concurrently (rate limiter handles throttling)
    let completed = successful.size; // Start with cached results

    const pollPromises = jobs.map(async (job) => {
      try {
        const content = await this.pollAndFetchContent(config.apiKey!, job.page, job.exportId);

        // Store in both successful map and cache
        successful.set(job.page.pageId, content);
        this.setCachedContent(job.page.pageId, content, job.pageUpdatedAt);

        completed++;
        onProgress?.(submitted, completed);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({
          pageId: job.page.pageId,
          pageName: job.page.name,
          path: job.page.path,
          error: errorMessage,
        });
        completed++;
        onProgress?.(submitted, completed);
      }
    });

    await Promise.all(pollPromises);

    return { successful, failed };
  }

  /**
   * Poll for export completion and fetch content
   * Separated from submission for optimized concurrent polling
   */
  private async pollAndFetchContent(
    apiKey: string,
    page: PageHierarchyNode,
    exportId: string
  ): Promise<string> {
    // Poll for completion (rate-limited automatically by bottleneck)
    let attempts = 0;
    const maxAttempts = 60;
    const pollInterval = 2000;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const status = await this.apiClient.getExportStatus(
          apiKey,
          page.docId,
          page.pageId,
          exportId
        );

        if (status.status === 'complete') {
          if (!status.downloadLink) {
            throw new Error('Export completed but no download link provided');
          }

          // Fetch content with retry
          const content = await this.retryOperation(
            async () => {
              const response = await fetch(status.downloadLink!);
              if (!response.ok) {
                throw new Error(`Failed to fetch content: ${response.status}`);
              }
              return await response.text();
            },
            3,
            1000
          );

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
        const separator =
          `\n\n${'='.repeat(80)}\n` +
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
