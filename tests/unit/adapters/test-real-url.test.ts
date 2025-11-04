/**
 * Test real-world Coda URL
 */

import { CodaUrlParserAdapter } from '../../../src/adapters/url-parser/coda-url-parser.adapter';

describe('CodaUrlParserAdapter - Real World URLs', () => {
  let parser: CodaUrlParserAdapter;

  beforeEach(() => {
    parser = new CodaUrlParserAdapter();
  });

  it('should parse real Coda URL with page ID starting with "s"', () => {
    const url =
      'https://coda.io/d/Lexamica-Engineering_dcOqEtrkQpb/PRD_su9_XTNM?utm_source=slack&utm_content=comment_notification#_lu1_GrX_';

    const result = parser.parseUrl(url);

    expect(result).not.toBeNull();
    expect(result?.docId).toBe('Lexamica-Engineering_dcOqEtrkQpb');
    expect(result?.pageId).toBe('su9_XTNM');
  });

  it('should parse page IDs starting with various letters', () => {
    const testCases = [
      { url: 'https://coda.io/d/Doc_dABC/Page_p123', expectedPageId: 'p123' },
      { url: 'https://coda.io/d/Doc_dABC/Page_s456', expectedPageId: 's456' },
      { url: 'https://coda.io/d/Doc_dABC/Page_t789', expectedPageId: 't789' },
      { url: 'https://coda.io/d/Doc_dABC/Page_a1', expectedPageId: 'a1' },
      { url: 'https://coda.io/d/Doc_dABC/Page_P999', expectedPageId: 'P999' },
    ];

    testCases.forEach(({ url, expectedPageId }) => {
      const result = parser.parseUrl(url);
      expect(result).not.toBeNull();
      expect(result?.pageId).toBe(expectedPageId);
    });
  });

  it('should handle real URLs with query params and fragments', () => {
    const url = 'https://coda.io/d/Project_dABC123/Tasks_su123?filter=active&view=list#task-456';

    const result = parser.parseUrl(url);

    expect(result).not.toBeNull();
    expect(result?.docId).toBe('Project_dABC123');
    expect(result?.pageId).toBe('su123');
  });

  it('should still reject page IDs starting with numbers', () => {
    const url = 'https://coda.io/d/Doc_dABC/Page_123XYZ';

    const result = parser.parseUrl(url);

    expect(result).toBeNull();
  });

  it('should reject URLs without valid page ID pattern', () => {
    // No underscore before page segment
    const url = 'https://coda.io/d/Doc_dABC/PageNoUnderscore';

    const result = parser.parseUrl(url);

    expect(result).toBeNull();
  });
});
