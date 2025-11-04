/**
 * Zod schemas for export operations
 */

import { z } from 'zod';
import { CodaPageIdentifierSchema } from './api.schema';

/**
 * Export state
 */
export const ExportStateSchema = z.enum([
  'idle',
  'starting',
  'exporting',
  'polling',
  'downloading',
  'complete',
  'failed',
]);

export type ExportState = z.infer<typeof ExportStateSchema>;

/**
 * Export result
 */
export const ExportResultSchema = z.object({
  success: z.boolean(),
  state: ExportStateSchema,
  exportId: z.string().optional(),
  downloadUrl: z.string().optional(),
  fileName: z.string().optional(),
  error: z.string().optional(),
});

export type ExportResult = z.infer<typeof ExportResultSchema>;

/**
 * Export progress
 */
export const ExportProgressSchema = z.object({
  state: ExportStateSchema,
  message: z.string(),
  exportId: z.string().optional(),
  pageInfo: CodaPageIdentifierSchema.optional(),
});

export type ExportProgress = z.infer<typeof ExportProgressSchema>;
