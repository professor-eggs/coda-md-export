/**
 * Coda API Adapter - implements ApiClientPort for Coda API
 */

import { ApiClientPort } from '../../domain/ports/api-client.port';
import {
  User,
  UserSchema,
  ApiLink,
  ApiLinkSchema,
  BeginPageContentExportRequest,
  BeginPageContentExportResponse,
  BeginPageContentExportResponseSchema,
  PageContentExportStatusResponse,
  PageContentExportStatusResponseSchema,
  ApiErrorSchema,
} from '../../domain/models/api.schema';

const BASE_URL = 'https://coda.io/apis/v1';

export class CodaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly statusMessage?: string
  ) {
    super(message);
    this.name = 'CodaApiError';
  }
}

export class CodaApiAdapter implements ApiClientPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async whoami(apiKey: string): Promise<User> {
    const url = `${this.baseUrl}/whoami`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return UserSchema.parse(data);
  }

  async resolveBrowserLink(apiKey: string, url: string): Promise<ApiLink> {
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `${this.baseUrl}/resolveBrowserLink?url=${encodedUrl}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return ApiLinkSchema.parse(data);
  }

  async beginPageExport(
    apiKey: string,
    docId: string,
    pageId: string,
    request: BeginPageContentExportRequest
  ): Promise<BeginPageContentExportResponse> {
    const url = `${this.baseUrl}/docs/${encodeURIComponent(docId)}/pages/${encodeURIComponent(pageId)}/export`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return BeginPageContentExportResponseSchema.parse(data);
  }

  async getExportStatus(
    apiKey: string,
    docId: string,
    pageId: string,
    requestId: string
  ): Promise<PageContentExportStatusResponse> {
    const url = `${this.baseUrl}/docs/${encodeURIComponent(docId)}/pages/${encodeURIComponent(pageId)}/export/${encodeURIComponent(requestId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const data: unknown = await response.json();
    return PageContentExportStatusResponseSchema.parse(data);
  }

  async downloadExport(downloadUrl: string): Promise<Blob> {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new CodaApiError(
        `Failed to download export: ${response.statusText}`,
        response.status,
        response.statusText
      );
    }

    return await response.blob();
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `API request failed: ${response.statusText}`;
    let statusCode = response.status;
    let statusMessage = response.statusText;

    try {
      const errorData: unknown = await response.json();
      const parsedError = ApiErrorSchema.safeParse(errorData);

      if (parsedError.success) {
        errorMessage = parsedError.data.message;
        statusCode = parsedError.data.statusCode;
        statusMessage = parsedError.data.statusMessage;
      }
    } catch {
      // If we can't parse the error, use the default message
    }

    throw new CodaApiError(errorMessage, statusCode, statusMessage);
  }
}
