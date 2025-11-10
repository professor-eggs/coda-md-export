/**
 * Unit tests for nested export schemas
 */

import {
  NestedExportDepthSchema,
  PageHierarchyNodeSchema,
  NestedExportSettingsSchema,
  PageCountResultSchema,
  FailedPageExportSchema,
  CombinedExportResultSchema,
  NestedExportProgressSchema,
  DEFAULT_NESTED_EXPORT_SETTINGS,
} from '../../../src/domain/models/nested-export.schema';

describe('NestedExportDepthSchema', () => {
  it('should accept valid depth numbers', () => {
    expect(() => NestedExportDepthSchema.parse(0)).not.toThrow();
    expect(() => NestedExportDepthSchema.parse(1)).not.toThrow();
    expect(() => NestedExportDepthSchema.parse(10)).not.toThrow();
  });

  it('should accept "unlimited"', () => {
    expect(() => NestedExportDepthSchema.parse('unlimited')).not.toThrow();
  });

  it('should reject invalid values', () => {
    expect(() => NestedExportDepthSchema.parse(-1)).toThrow();
    expect(() => NestedExportDepthSchema.parse(11)).toThrow();
    expect(() => NestedExportDepthSchema.parse('invalid')).toThrow();
  });
});

describe('PageHierarchyNodeSchema', () => {
  it('should accept valid node without children', () => {
    const node = {
      pageId: 'page-1',
      docId: 'doc-1',
      name: 'Root Page',
      depth: 0,
      path: '0',
      children: [],
    };

    expect(() => PageHierarchyNodeSchema.parse(node)).not.toThrow();
  });

  it('should accept valid node with children', () => {
    const node = {
      pageId: 'page-1',
      docId: 'doc-1',
      name: 'Root Page',
      depth: 0,
      path: '0',
      children: [
        {
          pageId: 'page-2',
          docId: 'doc-1',
          name: 'Child Page',
          depth: 1,
          path: '1',
          children: [],
        },
      ],
    };

    expect(() => PageHierarchyNodeSchema.parse(node)).not.toThrow();
  });

  it('should accept deeply nested structure', () => {
    const node = {
      pageId: 'page-1',
      docId: 'doc-1',
      name: 'Root',
      depth: 0,
      path: '0',
      children: [
        {
          pageId: 'page-2',
          docId: 'doc-1',
          name: 'Child 1',
          depth: 1,
          path: '1',
          children: [
            {
              pageId: 'page-3',
              docId: 'doc-1',
              name: 'Grandchild',
              depth: 2,
              path: '1.1',
              children: [],
            },
          ],
        },
      ],
    };

    expect(() => PageHierarchyNodeSchema.parse(node)).not.toThrow();
  });
});

describe('NestedExportSettingsSchema', () => {
  it('should use default values', () => {
    const result = NestedExportSettingsSchema.parse({});
    expect(result.includeNested).toBe(false);
    expect(result.depth).toBe(1);
  });

  it('should accept custom values', () => {
    const result = NestedExportSettingsSchema.parse({
      includeNested: true,
      depth: 5,
    });
    expect(result.includeNested).toBe(true);
    expect(result.depth).toBe(5);
  });

  it('should accept unlimited depth', () => {
    const result = NestedExportSettingsSchema.parse({
      includeNested: true,
      depth: 'unlimited',
    });
    expect(result.depth).toBe('unlimited');
  });
});

describe('PageCountResultSchema', () => {
  it('should accept valid page count result', () => {
    const result = {
      totalPages: 5,
      byDepth: {
        '0': 1,
        '1': 3,
        '2': 1,
      },
      hierarchy: {
        pageId: 'page-1',
        docId: 'doc-1',
        name: 'Root',
        depth: 0,
        path: '0',
        children: [],
      },
      maxDepth: 2,
    };

    expect(() => PageCountResultSchema.parse(result)).not.toThrow();
  });
});

describe('FailedPageExportSchema', () => {
  it('should accept valid failed page export', () => {
    const failed = {
      pageId: 'page-1',
      pageName: 'Failed Page',
      path: '1.2',
      error: 'Export timeout',
    };

    expect(() => FailedPageExportSchema.parse(failed)).not.toThrow();
  });
});

describe('CombinedExportResultSchema', () => {
  it('should accept successful result', () => {
    const result = {
      success: true,
      totalPages: 5,
      successfulPages: 5,
      failedPages: [],
      combinedContent: '# Combined content',
    };

    expect(() => CombinedExportResultSchema.parse(result)).not.toThrow();
  });

  it('should accept result with failures', () => {
    const result = {
      success: false,
      totalPages: 5,
      successfulPages: 3,
      failedPages: [
        {
          pageId: 'page-1',
          pageName: 'Failed Page',
          path: '1.2',
          error: 'Export failed',
        },
      ],
      combinedContent: '# Partial content',
      error: 'Some pages failed to export',
    };

    expect(() => CombinedExportResultSchema.parse(result)).not.toThrow();
  });
});

describe('NestedExportProgressSchema', () => {
  it('should accept progress with minimal info', () => {
    const progress = {
      state: 'discovering' as const,
      message: 'Discovering pages...',
    };

    expect(() => NestedExportProgressSchema.parse(progress)).not.toThrow();
  });

  it('should accept progress with full info', () => {
    const progress = {
      state: 'exporting' as const,
      message: 'Exporting depth 1...',
      currentDepth: 1,
      pagesProcessed: 3,
      totalPages: 10,
    };

    expect(() => NestedExportProgressSchema.parse(progress)).not.toThrow();
  });
});

describe('DEFAULT_NESTED_EXPORT_SETTINGS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_NESTED_EXPORT_SETTINGS.includeNested).toBe(false);
    expect(DEFAULT_NESTED_EXPORT_SETTINGS.depth).toBe(1);
  });
});


