// Jest runs this file in Node; the app's tsconfig has no Node types, so the
// little of `fs` and `path` used here is typed for this file only.
declare const require: (id: 'fs' | 'path') => unknown;
declare const __dirname: string;
const { existsSync, readFileSync } = require('fs') as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { dirname, join, relative } = require('path') as {
  dirname: (path: string) => string;
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

/**
 * The Milo API compiles the app's own code instead of a copy of it
 * (server/tsconfig.json maps `@/…` to `src/`): the schemas, the course, its
 * validator, the rules of progress, and the clients the server's tests drive —
 * down to the app's sync and its SQLite repositories. That only works while
 * this code needs nothing but `zod` — no React Native, no Expo. This keeps it so.
 */
const SRC = join(__dirname, '../../..');

const SHARED_ENTRIES = [
  'schemas/index.ts',
  'content/course/index.ts',
  'features/course/logic/validate.ts',
  'constants/challenge.ts',
  'data/repositories/api/api-course-repository.ts',
  'data/repositories/api/course-api.ts',
  'data/repositories/api/api-auth-repository.ts',
  'services/api/api-client.ts',
  'services/auth/auth-session.ts',
  'services/auth/stored-session.ts',
  // Progress: the rules the server applies, and the app's side of sync that
  // the server's tests run against it.
  'data/repositories/course/course-reader.ts',
  'data/content/achievements.ts',
  'features/progress/logic/quest-scoring.ts',
  'features/achievements/logic/evaluate-achievements.ts',
  'features/exams/logic/exam.ts',
  'features/challenge/logic/calendar.ts',
  'lib/time-zone.ts',
  'features/progress/use-cases.ts',
  'features/onboarding/use-cases.ts',
  'data/repositories/owner-repositories.ts',
  'data/repositories/api/progress-api.ts',
  'services/session/owner-session.ts',
  'services/sync/progress-sync-engine.ts',
  // Teams: the rule the server derives the team streak with, the invite
  // codes both sides read, and the app's team client its tests drive.
  'features/friends/logic/team-streak.ts',
  'features/friends/logic/invite-code.ts',
  'features/friends/logic/team-errors.ts',
  'features/friends/use-cases.ts',
  'data/repositories/api/team-api.ts',
  'data/repositories/api/api-friends-repository.ts',
];

const importsOf = (code: string) =>
  [...code.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\(\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : join(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')])
    if (existsSync(candidate)) return candidate;
  return null;
}

function sharedClosure() {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = SHARED_ENTRIES.map((entry) => join(SRC, entry));
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || files.has(file)) continue;
    files.add(file);
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const resolved = resolveLocal(file, specifier);
        if (!resolved) throw new Error(`${relative(SRC, file)}: cannot resolve ${specifier}`);
        queue.push(resolved);
      } else {
        packages.add(specifier);
      }
    }
  }
  return { files: [...files].map((file) => relative(SRC, file)), packages: [...packages] };
}

describe('the course core shared with the server', () => {
  it('depends on nothing but zod', () => {
    expect(sharedClosure().packages).toEqual(['zod']);
  });

  it('stays out of the UI and the device', () => {
    const { files } = sharedClosure();
    expect(files.filter((file) => file.endsWith('.tsx'))).toEqual([]);
    expect(
      files.filter((file) =>
        /^(app|components|hooks|providers|stores|theme|services\/(audio|haptics|notifications))\//.test(
          file,
        ),
      ),
    ).toEqual([]);
  });
});
