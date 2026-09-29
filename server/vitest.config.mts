import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * API tests: the real Nest app, in process, against an isolated PostgreSQL
 * database (`milo_test`) that is migrated before the run and emptied before
 * each test — never the development database.
 */
export default defineConfig({
  resolve: {
    alias: [
      // The app's shared schemas and course core, compiled from the app itself.
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL('../src/$1', import.meta.url)) },
    ],
    // One zod for the server and the app code it runs.
    dedupe: ['zod'],
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup-env.ts'],
    globalSetup: ['test/global-setup.ts'],
    // One database: files run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
