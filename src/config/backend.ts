import { z } from 'zod';

/**
 * Which backend the app talks to, fixed at build time from `EXPO_PUBLIC_*`
 * variables (`.env.local` in development, the build profile in CI):
 *
 * - no `EXPO_PUBLIC_API_URL`: local mode, as before — no account, the bundled
 *   course, everything on the device;
 * - `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1`: an account on the Milo
 *   API, and the course from the API (cached for offline play);
 * - plus `EXPO_PUBLIC_COURSE_SOURCE=bundled`: the account, but the bundled
 *   course — for working on content without a server round trip.
 */
export type BackendConfig = {
  /** The API root, without a trailing slash; `null` in local mode. */
  apiUrl: string | null;
  course: 'bundled' | 'api';
};

const ApiUrlSchema = z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' });

export function readBackendConfig(env: {
  apiUrl?: string | undefined;
  courseSource?: string | undefined;
}): BackendConfig {
  const raw = env.apiUrl?.trim();
  if (!raw) return { apiUrl: null, course: 'bundled' };
  const parsed = ApiUrlSchema.safeParse(raw);
  // A wrong address is a build mistake: fail loudly instead of running local.
  if (!parsed.success) throw new Error(`EXPO_PUBLIC_API_URL "${raw}" must be an http(s) URL`);
  const courseSource = env.courseSource?.trim();
  if (courseSource && courseSource !== 'api' && courseSource !== 'bundled')
    throw new Error(`EXPO_PUBLIC_COURSE_SOURCE "${courseSource}" must be "api" or "bundled"`);
  return {
    apiUrl: parsed.data.replace(/\/+$/, ''),
    course: courseSource === 'bundled' ? 'bundled' : 'api',
  };
}

// Spelled out in full: Expo inlines each `process.env.EXPO_PUBLIC_*` at build time.
export const backendConfig = readBackendConfig({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  courseSource: process.env.EXPO_PUBLIC_COURSE_SOURCE,
});
