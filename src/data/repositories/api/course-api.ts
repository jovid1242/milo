import { CourseManifestSchema, type CourseManifest } from '@/schemas';
import type { ApiClient } from '@/services/api/api-client';
import { errorFromResponse } from '@/services/api/api-error';

/** The course endpoints: a small manifest to check, the document to download. */
export interface CourseApi {
  manifest(): Promise<CourseManifest>;
  /** The document's text exactly as served — it is hashed before it is parsed. */
  document(path: string): Promise<string>;
}

export class HttpCourseApi implements CourseApi {
  constructor(private readonly client: ApiClient) {}

  manifest(): Promise<CourseManifest> {
    return this.client.request({ path: '/course/current', schema: CourseManifestSchema });
  }

  async document(path: string): Promise<string> {
    const response = await this.client.send({ path });
    if (response.status !== 200) throw errorFromResponse(response.status, response.text);
    return response.text;
  }
}
