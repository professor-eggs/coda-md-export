/**
 * Zod schemas for user settings
 */

import { z } from 'zod';

/**
 * Export format options
 */
export const ExportFormatSchema = z.enum(['markdown', 'html']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

/**
 * User settings (simplified - just format for now)
 */
export const UserSettingsSchema = z.object({
  exportFormat: ExportFormatSchema.default('markdown'),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: UserSettings = {
  exportFormat: 'markdown',
};
