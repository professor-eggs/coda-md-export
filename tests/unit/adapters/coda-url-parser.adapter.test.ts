/**
 * Unit tests for CodaUrlParserAdapter
 */

import { CodaUrlParserAdapter } from '../../../src/adapters/url-parser/coda-url-parser.adapter';

describe('CodaUrlParserAdapter', () => {
  let parser: CodaUrlParserAdapter;

  beforeEach(() => {
    parser = new CodaUrlParserAdapter();
  });

  describe('isCodaUrl', () => {
    it('should return true for valid Coda URLs', () => {
      expect(parser.isCodaUrl('https://coda.io/d/Test_dABC123')).toBe(true);
      expect(parser.isCodaUrl('https://www.coda.io/d/Test_dABC123')).toBe(true);
      expect(parser.isCodaUrl('https://coda.io/d/Doc_dXYZ/Page_pABC')).toBe(true);
    });

    it('should return false for non-Coda URLs', () => {
      expect(parser.isCodaUrl('https://google.com')).toBe(false);
      expect(parser.isCodaUrl('https://example.com/coda.io')).toBe(false);
      expect(parser.isCodaUrl('http://coda.io/d/Test_dABC123')).toBe(false); // http not https
    });

    it('should return false for invalid URLs', () => {
      expect(parser.isCodaUrl('not a url')).toBe(false);
      expect(parser.isCodaUrl('')).toBe(false);
      expect(parser.isCodaUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('parseUrl', () => {
    it('should parse valid Coda page URL with doc and page', () => {
      const url = 'https://coda.io/d/My-Document_dABC123XYZ/Page-Name_pDEF456';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('My-Document_dABC123XYZ');
      expect(result?.pageId).toBe('pDEF456');
    });

    it('should parse URL with underscores in doc name', () => {
      const url = 'https://coda.io/d/My_Cool_Doc_dABC123/MyPage_p123XYZ789';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('My_Cool_Doc_dABC123');
      expect(result?.pageId).toBe('p123XYZ789');
    });

    it('should parse URL with query parameters', () => {
      const url = 'https://coda.io/d/Doc_dABC/Page_pXYZ?query=test&other=value';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('Doc_dABC');
      expect(result?.pageId).toBe('pXYZ');
    });

    it('should parse URL with hash fragment', () => {
      const url = 'https://coda.io/d/Doc_dABC/Page_pXYZ#section';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('Doc_dABC');
      expect(result?.pageId).toBe('pXYZ');
    });

    it('should parse URL with both query and hash', () => {
      const url = 'https://coda.io/d/Doc_dABC/Page_pXYZ?q=1#section';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('Doc_dABC');
      expect(result?.pageId).toBe('pXYZ');
    });

    it('should parse URL with www subdomain', () => {
      const url = 'https://www.coda.io/d/Doc_dABC/Page_pXYZ';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('Doc_dABC');
      expect(result?.pageId).toBe('pXYZ');
    });

    it('should return null for URL without page ID', () => {
      const url = 'https://coda.io/d/My-Document_dABC123XYZ';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for URL without doc ID', () => {
      const url = 'https://coda.io/';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for non-Coda URL', () => {
      const url = 'https://google.com';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const url = 'not a url';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for malformed Coda URL', () => {
      const url = 'https://coda.io/something/else';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should handle complex doc names with special characters', () => {
      const url = 'https://coda.io/d/Project-Plan-2024-Q1_dABC123/Sprint-Planning_pXYZ456';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('Project-Plan-2024-Q1_dABC123');
      expect(result?.pageId).toBe('pXYZ456');
    });

    it('should return null for empty doc ID', () => {
      const url = 'https://coda.io/d//Page_pXYZ';
      const result = parser.parseUrl(url);

      expect(result).toBeNull();
    });

    it('should return null for empty page ID after underscore', () => {
      const url = 'https://coda.io/d/Doc_dABC/Page_';
      const result = parser.parseUrl(url);

      // Empty page ID after cleaning should fail validation
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should reject URLs with trailing slashes', () => {
      // Trailing slashes break the path pattern
      const url = 'https://coda.io/d/Doc_dABC/Page_p123/';
      const result = parser.parseUrl(url);

      // Pattern expects no trailing slash, so this should be null
      expect(result).toBeNull();
    });

    it('should handle very long doc and page IDs', () => {
      const longDocId = 'A'.repeat(100) + '_dABC';
      const longPageId = 'p' + 'X'.repeat(100);
      const url = `https://coda.io/d/${longDocId}/Page_${longPageId}`;
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe(longDocId);
      expect(result?.pageId).toBe(longPageId);
    });

    it('should handle Unicode characters in page names (URL-encoded)', () => {
      // Browsers URL-encode Unicode characters in URLs
      const url = 'https://coda.io/d/%E6%96%87%E6%A1%A3_dABC/%E9%A1%B5%E9%9D%A2_p123';
      const result = parser.parseUrl(url);

      expect(result).not.toBeNull();
      expect(result?.docId).toBe('%E6%96%87%E6%A1%A3_dABC');
      expect(result?.pageId).toBe('p123');
    });
  });
});
