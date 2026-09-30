import { visibleSettingsSections } from '@/features/settings/logic/sections';

// Jest runs this file in Node; the app's tsconfig carries no Node types (the
// app never runs there), so the little of `fs` and `path` used here is typed
// for this file only.
declare const require: (id: 'fs' | 'path') => unknown;
declare const __dirname: string;
const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join, relative } = require('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

/**
 * Development fixtures (Day 30 / 60 / 89 / 90 states, onboarding resets) live
 * in `features/dev-tools` and must never become a production path. These
 * checks keep that true as the app grows: every place that can reach them is
 * named here, and each of those places is itself gated on `__DEV__`.
 */
const SRC = join(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === '__fixtures__' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  code: readFileSync(path, 'utf8'),
}));

/** Every module a file pulls in: `from '…'`, `import '…'`, `import('…')`, `require('…')`. */
const importsOf = (code: string) =>
  [...code.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\(\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );

describe('development fixtures stay out of production', () => {
  it('are reached only from the dev tools and the dev-only settings group', () => {
    const importers = files
      .filter(({ path }) => !path.startsWith('features/dev-tools/'))
      .filter(({ code }) => importsOf(code).some((from) => from.includes('features/dev-tools')))
      .map(({ path }) => path)
      .sort();

    expect(importers).toEqual(['app/dev-tools.tsx', 'features/settings/SettingsScreen.tsx']);
  });

  it('open the dev tools route only in development builds', () => {
    const route = files.find(({ path }) => path === 'app/dev-tools.tsx');
    expect(route?.code).toMatch(/if \(!__DEV__\) return <Redirect/);
  });

  it('show the settings developer group only in development builds', () => {
    for (const account of [false, true])
      expect(
        visibleSettingsSections({ devBuild: false, account, teamNotifications: true }),
      ).not.toContain('developer');
  });

  it('never let the in-memory test repositories into the app', () => {
    const leaks = files
      .filter(({ path }) => !path.startsWith('data/repositories/memory/'))
      .filter(({ code }) => importsOf(code).some((from) => from.includes('repositories/memory')))
      .map(({ path }) => path);

    expect(leaks).toEqual([]);
  });
});
