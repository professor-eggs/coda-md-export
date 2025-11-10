/**
 * Zod schemas for nested page export operations
 */

import { z } from 'zod';

/**
 * Export depth - can be a number or 'unlimited'
 */
export const NestedExportDepthSchema = z.union([
  z.number().int().min(0).max(10), // Practical limit of 10 levels
  z.literal('unlimited'),
]);

export type NestedExportDepth = z.infer<typeof NestedExportDepthSchema>;

/**
 * Page reference in hierarchy (minimal info from PageReference)
 */
export const PageReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string().url(),
  browserLink: z.string().url(),
});

export type PageReference = z.infer<typeof PageReferenceSchema>;

/**
 * Node in page hierarchy tree
 */
export type PageHierarchyNode = {
  pageId: string;
  docId: string;
  name: string;
  depth: number;
  path: string;
  children: PageHierarchyNode[];
};

// Zod schema for runtime validation
export const PageHierarchyNodeSchema: z.ZodType<PageHierarchyNode> = z.lazy(() =>
  z.object({
    pageId: z.string(),
    docId: z.string(),
    name: z.string(),
    depth: z.number().int().min(0),
    path: z.string(), // e.g., "0", "1", "1.1", "1.2.3"
    children: z.array(PageHierarchyNodeSchema),
  })
);

/**
 * Settings for nested export
 */
export const NestedExportSettingsSchema = z.object({
  includeNested: z.boolean().default(false),
  depth: NestedExportDepthSchema.default(1),
});

export type NestedExportSettings = z.infer<typeof NestedExportSettingsSchema>;

/**
 * Result of counting pages in hierarchy
 */
export const PageCountResultSchema = z.object({
  totalPages: z.number().int().min(1),
  byDepth: z.record(z.string(), z.number()), // e.g., { "0": 1, "1": 3, "2": 5 }
  hierarchy: PageHierarchyNodeSchema,
  maxDepth: z.number().int().min(0),
});

export type PageCountResult = z.infer<typeof PageCountResultSchema>;

/**
 * Failed page export info
 */
export const FailedPageExportSchema = z.object({
  pageId: z.string(),
  pageName: z.string(),
  path: z.string(),
  error: z.string(),
});

export type FailedPageExport = z.infer<typeof FailedPageExportSchema>;

/**
 * Combined export result
 */
export const CombinedExportResultSchema = z.object({
  success: z.boolean(),
  totalPages: z.number().int().min(0),
  successfulPages: z.number().int().min(0),
  failedPages: z.array(FailedPageExportSchema),
  combinedContent: z.string(),
  error: z.string().optional(),
});

export type CombinedExportResult = z.infer<typeof CombinedExportResultSchema>;

/**
 * State for nested export progress
 */
export const NestedExportStateSchema = z.enum([
  'discovering',
  'exporting',
  'combining',
  'complete',
  'failed',
]);

export type NestedExportState = z.infer<typeof NestedExportStateSchema>;

/**
 * Progress update for nested export
 */
export const NestedExportProgressSchema = z.object({
  state: NestedExportStateSchema,
  message: z.string(),
  currentDepth: z.number().int().min(0).optional(),
  pagesProcessed: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
});

export type NestedExportProgress = z.infer<typeof NestedExportProgressSchema>;

/**
 * Default settings
 */
export const DEFAULT_NESTED_EXPORT_SETTINGS: NestedExportSettings = {
  includeNested: false,
  depth: 1,
};

