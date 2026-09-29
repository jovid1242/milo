import { execFileSync } from 'node:child_process';

import type { TestProject } from 'vitest/node';

import { TEST_DATABASE_URL, assertTestDatabase } from './test-env';

/** Brings the test database to the latest migration — the same `migrate deploy` production runs. */
export default function globalSetup(project: TestProject): void {
  assertTestDatabase(TEST_DATABASE_URL);
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: project.config.root,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (error) {
    const output = (error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? '';
    const errors = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(
      `Could not migrate the test database (is PostgreSQL up? npm run db:up)\n${output}${errors}`,
      { cause: error },
    );
  }
}
