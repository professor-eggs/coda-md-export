/**
 * Zod schemas for Coda API models
 * Based on the Coda API OpenAPI specification
 */

import { z } from 'zod';

/**
 * Base API error schema
 */
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  statusMessage: z.string(),
  message: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Workspace reference schema
 */
export const WorkspaceReferenceSchema = z.object({
  id: z.string(),
  type: z.literal('workspace'),
  browserLink: z.string().url(),
  name: z.string(),
  organizationId: z.string().optional(),
});

export type WorkspaceReference = z.infer<typeof WorkspaceReferenceSchema>;

/**
 * User schema from /whoami endpoint
 */
export const UserSchema = z.object({
  name: z.string(),
  loginId: z.string(),
  type: z.literal('user'),
  scoped: z.boolean(),
  tokenName: z.string(),
  href: z.string().url(),
  workspace: WorkspaceReferenceSchema,
  pictureLink: z.string().url().optional(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Page content output format
 */
export const PageContentOutputFormatSchema = z.enum(['html', 'markdown']);

export type PageContentOutputFormat = z.infer<typeof PageContentOutputFormatSchema>;

/**
 * Request body for beginning a page content export
 */
export const BeginPageContentExportRequestSchema = z.object({
  outputFormat: PageContentOutputFormatSchema,
});

export type BeginPageContentExportRequest = z.infer<typeof BeginPageContentExportRequestSchema>;

/**
 * Page content export status
 */
export const PageContentExportStatusSchema = z.enum(['inProgress', 'failed', 'complete']);

export type PageContentExportStatus = z.infer<typeof PageContentExportStatusSchema>;

/**
 * Response from beginning a page content export
 */
export const BeginPageContentExportResponseSchema = z.object({
  id: z.string(),
  status: PageContentExportStatusSchema,
  href: z.string().url(),
});

export type BeginPageContentExportResponse = z.infer<typeof BeginPageContentExportResponseSchema>;

/**
 * Response from checking page content export status
 */
export const PageContentExportStatusResponseSchema = z.object({
  id: z.string(),
  status: PageContentExportStatusSchema,
  href: z.string().url(),
  downloadLink: z.string().url().optional(),
  error: z.string().optional(),
});

export type PageContentExportStatusResponse = z.infer<typeof PageContentExportStatusResponseSchema>;

/**
 * Doc and page identifiers from a Coda URL
 */
export const CodaPageIdentifierSchema = z.object({
  docId: z.string().min(1),
  pageId: z.string().min(1),
});

export type CodaPageIdentifier = z.infer<typeof CodaPageIdentifierSchema>;

/**
 * Resource type from API
 */
export const ResourceTypeSchema = z.enum([
  'doc',
  'page',
  'table',
  'view',
  'column',
  'row',
  'formula',
  'control',
  'button',
  'automation',
  'pack',
]);

export type ResourceType = z.infer<typeof ResourceTypeSchema>;

/**
 * Resolved resource from resolveBrowserLink
 */
export const ApiLinkResolvedResourceSchema = z.object({
  type: ResourceTypeSchema,
  id: z.string(),
  href: z.string().url(),
  name: z.string().optional(),
});

export type ApiLinkResolvedResource = z.infer<typeof ApiLinkResolvedResourceSchema>;

/**
 * Response from resolveBrowserLink endpoint
 */
export const ApiLinkSchema = z.object({
  type: z.literal('apiLink'),
  href: z.string().url(),
  browserLink: z.string().url(),
  resource: ApiLinkResolvedResourceSchema,
});

export type ApiLink = z.infer<typeof ApiLinkSchema>;

/**
 * Page reference (minimal page info used in lists and children arrays)
 */
export const PageReferenceSchema = z.object({
  id: z.string(),
  type: z.literal('page'),
  href: z.string().url(),
  name: z.string(),
  browserLink: z.string().url().optional(),
});

export type PageReference = z.infer<typeof PageReferenceSchema>;

/**
 * Page content type
 */
export const PageTypeSchema = z.enum(['canvas', 'embed']);

export type PageType = z.infer<typeof PageTypeSchema>;

/**
 * Full page details from GET /docs/{docId}/pages/{pageId}
 */
export const PageSchema = z.object({
  id: z.string(),
  type: z.literal('page'),
  href: z.string().url(),
  name: z.string(),
  browserLink: z.string().url(),
  subtitle: z.string().optional(),
  contentType: PageTypeSchema,
  isHidden: z.boolean(),
  isEffectivelyHidden: z.boolean(),
  parent: PageReferenceSchema.optional(),
  children: z.array(PageReferenceSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Page = z.infer<typeof PageSchema>;

/**
 * Response from GET /docs/{docId}/pages
 */
export const PageListSchema = z.object({
  items: z.array(PageReferenceSchema),
  href: z.string().url().optional(),
  nextPageToken: z.string().optional(),
  nextPageLink: z.string().url().optional(),
});

export type PageList = z.infer<typeof PageListSchema>;
