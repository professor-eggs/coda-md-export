/**
 * Zod schemas for page information
 */

import { z } from 'zod';
import { CodaPageIdentifierSchema } from './api.schema';

/**
 * Page detection result
 */
export const PageDetectionResultSchema = z.object({
  detected: z.boolean(),
  pageInfo: CodaPageIdentifierSchema.optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export type PageDetectionResult = z.infer<typeof PageDetectionResultSchema>;

/**
 * Message types for communication between content script and popup
 */
export const MessageTypeSchema = z.enum(['GET_PAGE_INFO', 'PAGE_INFO_RESPONSE']);

export type MessageType = z.infer<typeof MessageTypeSchema>;

/**
 * Message format for extension communication
 */
export const ExtensionMessageSchema = z.object({
  type: MessageTypeSchema,
  payload: z.unknown().optional(),
});

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

/**
 * Page info request message
 */
export const PageInfoRequestSchema = ExtensionMessageSchema.extend({
  type: z.literal('GET_PAGE_INFO'),
});

export type PageInfoRequest = z.infer<typeof PageInfoRequestSchema>;

/**
 * Page info response message
 */
export const PageInfoResponseSchema = ExtensionMessageSchema.extend({
  type: z.literal('PAGE_INFO_RESPONSE'),
  payload: PageDetectionResultSchema,
});

export type PageInfoResponse = z.infer<typeof PageInfoResponseSchema>;
