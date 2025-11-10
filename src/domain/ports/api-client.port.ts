/**
 * API Client port - interface for external API operations
 * This abstraction allows us to swap API client implementations or mock them for testing
 */

import {
  User,
  BeginPageContentExportRequest,
  BeginPageContentExportResponse,
  PageContentExportStatusResponse,
  ApiLink,
  PageList,
  Page,
} from '../models/api.schema';

export interface ApiClientPort {
  /**
   * Call the /whoami endpoint to verify the API key and get user info
   */
  whoami(apiKey: string): Promise<User>;

  /**
   * Resolve a browser link to get resource metadata
   */
  resolveBrowserLink(apiKey: string, url: string): Promise<ApiLink>;

  /**
   * List all pages in a document
   */
  listPages(apiKey: string, docId: string): Promise<PageList>;

  /**
   * Get details about a specific page
   */
  getPage(apiKey: string, docId: string, pageId: string): Promise<Page>;

  /**
   * Begin a page content export
   */
  beginPageExport(
    apiKey: string,
    docId: string,
    pageId: string,
    request: BeginPageContentExportRequest
  ): Promise<BeginPageContentExportResponse>;

  /**
   * Check the status of a page content export
   */
  getExportStatus(
    apiKey: string,
    docId: string,
    pageId: string,
    requestId: string
  ): Promise<PageContentExportStatusResponse>;

  /**
   * Download the exported file
   */
  downloadExport(downloadUrl: string): Promise<Blob>;
}
