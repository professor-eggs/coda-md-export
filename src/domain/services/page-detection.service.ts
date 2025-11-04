/**
 * Page Detection Service - domain service for detecting and managing current page info
 */

import { CodaPageIdentifier } from '../models/api.schema';
import { PageDetectionResult } from '../models/page-info.schema';
import { ApiClientPort } from '../ports/api-client.port';
import { StoragePort } from '../ports/storage.port';

export class PageDetectionService {
  constructor(
    private readonly apiClient: ApiClientPort,
    private readonly storage: StoragePort
  ) {}

  /**
   * Request page information from the active tab using resolveBrowserLink
   */
  async getCurrentPageInfo(): Promise<PageDetectionResult> {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab.url) {
        return {
          detected: false,
          error: 'No active tab found',
        };
      }

      // Check if it's a Coda URL
      if (!this.isCodaUrl(tab.url)) {
        return {
          detected: false,
          url: tab.url,
          error: 'Not a Coda page',
        };
      }

      // Get API key from storage
      const config = await this.storage.getConfiguration();
      if (!config.isConfigured || !config.apiKey) {
        return {
          detected: false,
          url: tab.url,
          error: 'API key not configured',
        };
      }

      // Use resolveBrowserLink to get the real page ID
      const resolved = await this.apiClient.resolveBrowserLink(config.apiKey, tab.url);

      // Ensure it's a page resource
      if (resolved.resource.type !== 'page') {
        return {
          detected: false,
          url: tab.url,
          error: `URL points to a ${resolved.resource.type}, not a page`,
        };
      }

      // Extract doc ID from the href
      // href format: https://coda.io/apis/v1/docs/{docId}/pages/{pageId}
      const hrefMatch = resolved.resource.href.match(/\/docs\/([^/]+)\/pages\/([^/]+)/);
      if (!hrefMatch || !hrefMatch[1] || !hrefMatch[2]) {
        return {
          detected: false,
          url: tab.url,
          error: 'Could not parse doc and page IDs from API response',
        };
      }

      const pageInfo: CodaPageIdentifier = {
        docId: hrefMatch[1],
        pageId: hrefMatch[2],
      };

      return {
        detected: true,
        url: tab.url,
        pageInfo,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          detected: false,
          error: `Error detecting page: ${error.message}`,
        };
      }

      return {
        detected: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if a URL is a Coda URL (basic check)
   */
  private isCodaUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'coda.io' || urlObj.hostname === 'www.coda.io';
    } catch {
      return false;
    }
  }

  /**
   * Format page identifier for display
   */
  formatPageIdentifier(pageInfo: CodaPageIdentifier): string {
    return `Doc: ${pageInfo.docId} | Page: ${pageInfo.pageId}`;
  }
}
