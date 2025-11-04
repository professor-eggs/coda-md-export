/**
 * URL Parser port - interface for extracting Coda identifiers from URLs
 * This abstraction allows us to swap URL parsing implementations
 */

import { CodaPageIdentifier } from '../models/api.schema';

export interface UrlParserPort {
  /**
   * Parse a Coda URL to extract doc and page identifiers
   * Returns null if the URL is not a valid Coda page URL
   */
  parseUrl(url: string): CodaPageIdentifier | null;

  /**
   * Check if a URL is a valid Coda URL
   */
  isCodaUrl(url: string): boolean;
}
