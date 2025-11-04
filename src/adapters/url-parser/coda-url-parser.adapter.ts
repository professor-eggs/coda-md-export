/**
 * Coda URL Parser Adapter - implements UrlParserPort for parsing Coda URLs
 *
 * Coda URL formats:
 * - https://coda.io/d/{docId}/{docName}_{pageId}
 * - https://coda.io/d/{docId}/{docName}
 * - https://coda.io/d/{docId}
 */

import { UrlParserPort } from '../../domain/ports/url-parser.port';
import { CodaPageIdentifier, CodaPageIdentifierSchema } from '../../domain/models/api.schema';

export class CodaUrlParserAdapter implements UrlParserPort {
  // Match pathname: /d/{docId}/{pageName}_{pageId}
  // Use non-greedy match to capture from first underscore followed by letter+wordchars
  private readonly pathPattern = /^\/d\/([^/]+)\/(.+?)_([a-zA-Z][\w]+)$/;

  parseUrl(url: string): CodaPageIdentifier | null {
    if (!this.isCodaUrl(url)) {
      return null;
    }

    try {
      // Parse URL to get pathname (excludes query params and hash)
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(this.pathPattern);

      if (!match) {
        return null;
      }

      const docId = match[1];
      const pageId = match[3]; // pageId is in capture group 3

      // If no page ID in URL, it's likely the canvas/home page
      // Coda uses special IDs for these, but we need at least docId and pageId
      if (!docId || !pageId) {
        return null;
      }

      // Validate the extracted data
      const identifier = CodaPageIdentifierSchema.parse({
        docId: this.cleanId(docId),
        pageId: this.cleanId(pageId),
      });

      return identifier;
    } catch {
      // If URL parsing or validation fails, return null
      return null;
    }
  }

  isCodaUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.protocol === 'https:' &&
        (urlObj.hostname === 'coda.io' || urlObj.hostname === 'www.coda.io')
      );
    } catch {
      return false;
    }
  }

  /**
   * Clean the ID by removing any query parameters or fragments
   */
  private cleanId(id: string): string {
    return id.split('?')[0]?.split('#')[0] ?? id;
  }
}
