import {
  ProgressResponseSchema,
  SyncResponseSchema,
  type ProgressResponse,
  type SyncRequest,
  type SyncResponse,
} from '@/schemas';
import type { ApiClient } from '@/services/api/api-client';

/** Progress on the Milo API: the outbox goes up, the account's progress comes back. */
export interface ProgressApi {
  sync(request: SyncRequest, signal?: AbortSignal): Promise<SyncResponse>;
  progress(signal?: AbortSignal): Promise<ProgressResponse>;
}

export class HttpProgressApi implements ProgressApi {
  constructor(private readonly client: ApiClient) {}

  sync(request: SyncRequest, signal?: AbortSignal): Promise<SyncResponse> {
    return this.client.request({
      method: 'POST',
      path: '/progress/sync',
      body: request,
      schema: SyncResponseSchema,
      auth: true,
      signal,
    });
  }

  progress(signal?: AbortSignal): Promise<ProgressResponse> {
    return this.client.request({
      path: '/progress',
      schema: ProgressResponseSchema,
      auth: true,
      signal,
    });
  }
}
