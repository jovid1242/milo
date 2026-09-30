import { LOCAL_COURSE } from '@/content/course';

import { NodeSqliteStore } from '../__fixtures__/node-sqlite-store';
import type { SqlDatabase } from '../local-store';
import {
  LEGACY_WORD_IDS,
  MIGRATIONS,
  courseWordId,
  renameWordIdsInJson,
  runMigrations,
} from '../migrations';

describe('migrations', () => {
  it('are numbered 1…n, in order, each once', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
    expect(MIGRATIONS.at(-1)?.name).toBe('teams on the server');
  });
});

/** Runs the migrations up to `version`, as an app of that version did. */
async function migrateTo(db: SqlDatabase, version: number) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (const migration of MIGRATIONS) {
    if (migration.version <= (row?.user_version ?? 0) || migration.version > version) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/** A database as an app at version 11 left it: real rows in every table. */
async function version11(db: SqlDatabase) {
  await migrateTo(db, 11);
  await db.execAsync(`
    INSERT INTO user_profile (id, display_name, challenge_start_date, created_at, goal, onboarded_at)
      VALUES ('local-user', 'Ada', '2026-08-01', '2026-08-01T08:00:00.000Z', 'habit', '2026-08-01T08:00:00.000Z');
    INSERT INTO quest_completions (quest_id, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at, course_version)
      VALUES ('d001-vocabulary', 1, 'vocabulary', 1, 6, 6, 30, 'user', '2026-08-01T09:00:00.000Z', 1),
             ('d001-grammar', 1, 'grammar', 0.75, 3, 4, 15, 'user', '2026-08-01T09:10:00.000Z', 1);
    INSERT INTO answers (quest_id, question_id, answer_json, is_correct, answered_at)
      VALUES ('d001-vocabulary', 'd001-vocab-1', '{"kind":"singleChoice","optionId":"vocab-journey"}', 1, '2026-08-01T09:00:00.000Z');
    INSERT INTO xp_events (amount, reason, ref_id, created_at)
      VALUES (30, 'quest', 'd001-vocabulary', '2026-08-01T09:00:00.000Z'),
             (15, 'quest', 'd001-grammar', '2026-08-01T09:10:00.000Z'),
             (40, 'achievement', 'perfectQuiz', '2026-08-01T09:00:00.000Z'),
             (40, 'achievement', 'perfectQuiz', '2026-08-01T09:05:00.000Z'),
             (250, 'dev', NULL, '2026-08-01T10:00:00.000Z');
    INSERT INTO achievement_unlocks (achievement_id, unlocked_at, celebrated_at)
      VALUES ('perfectQuiz', '2026-08-01T09:00:00.000Z', '2026-08-01T09:01:00.000Z');
    INSERT INTO quest_sessions (quest_id, started_at, updated_at, progress, state_json)
      VALUES ('d001-reading', '2026-08-01T09:20:00.000Z', '2026-08-01T09:21:00.000Z', 0.5, '{"phase":"story"}');
    INSERT INTO day_completions (day, completed_at, quest_count, xp_earned, streak_before, streak_after, is_perfect, celebrated_at)
      VALUES (1, '2026-08-01T09:30:00.000Z', 4, 105, 0, 1, 0, NULL);
    INSERT INTO learned_words (word_id, quest_id, learned_at)
      VALUES ('vocab-journey', 'd001-vocabulary', '2026-08-01T09:00:00.000Z');
    INSERT INTO exam_attempts (id, exam_id, quest_id, number, started_at, updated_at, current_index, answers_json, submitted_at, correct_count, total_count, score, passed, course_version)
      VALUES ('w1-1', 'week-01', 'd007-weeklyExam', 1, '2026-08-07T09:00:00.000Z', '2026-08-07T09:10:00.000Z', 8, '[]', '2026-08-07T09:10:00.000Z', 7, 9, 0.77, 1, 1),
             ('w1-2', 'week-01', 'd007-weeklyExam', 2, '2026-08-07T10:00:00.000Z', '2026-08-07T10:00:00.000Z', 0, '[]', NULL, NULL, 9, NULL, NULL, 1);
    INSERT INTO challenge_completion (id, completed_at, final_attempt_id, correct_count, total_count, score, is_perfect, xp_earned, celebrated_at)
      VALUES (1, '2026-10-29T09:00:00.000Z', 'final-1', 20, 20, 1, 1, 250, NULL);
    INSERT INTO team (id, name, invite_code, created_at) VALUES ('team-1', 'Our team', 'ABCD-1234', '2026-08-02T08:00:00.000Z');
    INSERT INTO team_members (id, display_name, joined_day, position) VALUES ('m1', 'Grace', 1, 0);
    INSERT INTO team_member_days (member_id, day) VALUES ('m1', 1);
    INSERT INTO team_activity (id, member_id, type, metadata_json, created_at) VALUES ('a1', 'm1', 'joined', '{}', '2026-08-02T08:00:00.000Z');
    INSERT INTO course_cache (slot, course_id, version, schema_version, content_hash, document, saved_at)
      VALUES (1, 'milo-english-90', 1, 1, 'abc', '{}', '2026-08-01T08:00:00.000Z');
  `);
}

describe('account-scoped progress (migration 12)', () => {
  const OWNED = [
    'user_profile',
    'quest_completions',
    'answers',
    'xp_events',
    'achievement_unlocks',
    'quest_sessions',
    'day_completions',
    'learned_words',
    'exam_attempts',
    'challenge_completion',
    'team',
    'team_members',
    'team_member_days',
    'team_activity',
  ];

  let store: NodeSqliteStore;
  let db: SqlDatabase;

  beforeEach(async () => {
    store = new NodeSqliteStore(':memory:', { migrate: false });
    db = await store.read();
    await version11(db);
    await migrateTo(db, 12);
  });
  afterEach(() => store.close());

  it('keeps every row of an existing database, as the device’s own', async () => {
    await expect(db.getFirstAsync('PRAGMA user_version')).resolves.toEqual({ user_version: 12 });
    const counts: Record<string, number> = {};
    for (const table of OWNED) {
      const rows = await db.getAllAsync<{ owner_id: string }>(`SELECT owner_id FROM ${table}`);
      expect(rows.every((row) => row.owner_id === 'local')).toBe(true);
      counts[table] = rows.length;
    }
    expect(counts).toEqual({
      user_profile: 1,
      quest_completions: 2,
      answers: 1,
      // The second payment of the same badge was never valid: a badge pays once.
      xp_events: 4,
      achievement_unlocks: 1,
      quest_sessions: 1,
      day_completions: 1,
      learned_words: 1,
      exam_attempts: 2,
      challenge_completion: 1,
      team: 1,
      team_members: 1,
      team_member_days: 1,
      team_activity: 1,
    });
    await expect(
      db.getFirstAsync('SELECT display_name, goal, onboarded_at FROM user_profile'),
    ).resolves.toEqual({
      display_name: 'Ada',
      goal: 'habit',
      onboarded_at: '2026-08-01T08:00:00.000Z',
    });
    await expect(
      db.getFirstAsync("SELECT SUM(amount) AS xp FROM xp_events WHERE owner_id = 'local'"),
    ).resolves.toEqual({ xp: 30 + 15 + 40 + 250 });
    // Celebrations shown stay shown; the open attempt stays open.
    await expect(
      db.getFirstAsync('SELECT celebrated_at FROM achievement_unlocks'),
    ).resolves.toEqual({ celebrated_at: '2026-08-01T09:01:00.000Z' });
    await expect(
      db.getFirstAsync('SELECT id FROM exam_attempts WHERE submitted_at IS NULL'),
    ).resolves.toEqual({ id: 'w1-2' });
    // The downloaded course is the device's, not an owner's: untouched.
    await expect(db.getFirstAsync('SELECT course_id FROM course_cache')).resolves.toEqual({
      course_id: 'milo-english-90',
    });
    // Nothing is marked as waiting for a server; the outbox starts empty.
    await expect(
      db.getFirstAsync(
        'SELECT COUNT(*) AS n FROM quest_completions WHERE pending_mutation_id IS NOT NULL',
      ),
    ).resolves.toEqual({ n: 0 });
    await expect(db.getFirstAsync('SELECT COUNT(*) AS n FROM outbox')).resolves.toEqual({ n: 0 });
  });

  it('lets another owner hold the same keys — and still no owner hold them twice', async () => {
    await db.execAsync(`
      INSERT INTO quest_completions (owner_id, quest_id, course_version, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at)
        VALUES ('account-b', 'd001-vocabulary', 1, 1, 'vocabulary', 1, 6, 6, 30, 'user', '2026-09-01T09:00:00.000Z');
      INSERT INTO day_completions (owner_id, day, completed_at, quest_count, xp_earned, streak_before, streak_after, is_perfect)
        VALUES ('account-b', 1, '2026-09-01T09:30:00.000Z', 4, 105, 0, 1, 1);
      INSERT INTO xp_events (owner_id, amount, reason, ref_id, created_at)
        VALUES ('account-b', 30, 'quest', 'd001-vocabulary', '2026-09-01T09:00:00.000Z');
    `);
    await expect(
      db.execAsync(`INSERT INTO quest_completions (owner_id, quest_id, course_version, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at)
        VALUES ('account-b', 'd001-vocabulary', 1, 1, 'vocabulary', 1, 6, 6, 30, 'user', '2026-09-01T09:00:00.000Z')`),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      db.execAsync(`INSERT INTO xp_events (owner_id, amount, reason, ref_id, created_at)
        VALUES ('account-b', 30, 'quest', 'd001-vocabulary', '2026-09-01T09:00:00.000Z')`),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      db.execAsync(`INSERT INTO xp_events (owner_id, amount, reason, ref_id, created_at)
        VALUES ('account-b', 40, 'achievement', 'perfectQuiz', '2026-09-01T09:00:00.000Z'),
               ('account-b', 40, 'achievement', 'perfectQuiz', '2026-09-01T09:00:00.000Z')`),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('runs once: a second launch changes nothing', async () => {
    await runMigrations(db);
    await runMigrations(db);
    await expect(db.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: MIGRATIONS.length,
    });
    await expect(db.getFirstAsync('SELECT COUNT(*) AS n FROM quest_completions')).resolves.toEqual({
      n: 2,
    });
  });
});

describe('teams on the server (migration 13)', () => {
  let store: NodeSqliteStore;
  let db: SqlDatabase;

  beforeEach(async () => {
    store = new NodeSqliteStore(':memory:', { migrate: false });
    db = await store.read();
    await version11(db);
    await runMigrations(db);
  });
  afterEach(() => store.close());

  it('drops the local team — it only ever held a team nobody could join', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'team%' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toEqual(['team_cache']);
    await expect(db.getFirstAsync('SELECT COUNT(*) AS n FROM team_cache')).resolves.toEqual({
      n: 0,
    });
  });

  it('leaves the progress alone', async () => {
    await expect(db.getFirstAsync('SELECT COUNT(*) AS n FROM quest_completions')).resolves.toEqual({
      n: 2,
    });
    await expect(
      db.getFirstAsync("SELECT SUM(amount) AS xp FROM xp_events WHERE owner_id = 'local'"),
    ).resolves.toEqual({ xp: 30 + 15 + 40 + 250 });
    await expect(db.getFirstAsync('SELECT COUNT(*) AS n FROM day_completions')).resolves.toEqual({
      n: 1,
    });
  });

  it('keeps one answer per owner', async () => {
    await db.execAsync(`
      INSERT INTO team_cache (owner_id, team_json, as_of) VALUES ('account-a', NULL, '2026-09-30T10:00:00.000Z');
    `);
    await expect(
      db.execAsync(
        "INSERT INTO team_cache (owner_id, team_json, as_of) VALUES ('account-a', NULL, '2026-09-30T11:00:00.000Z')",
      ),
    ).rejects.toThrow(/UNIQUE|PRIMARY KEY/);
  });
});

describe('a fresh install', () => {
  it('migrates an empty database straight to the current schema', async () => {
    const store = new NodeSqliteStore();
    const db = await store.read();
    await expect(db.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: MIGRATIONS.length,
    });
    await store.close();
  });
});

describe('course-wide word ids (migration 10)', () => {
  it('renames the words stored before the id convention, and nothing else', () => {
    expect(courseWordId('journey')).toBe('vocab-journey');
    expect(courseWordId('overcome')).toBe('vocab-overcome');
    for (const untouched of ['vocab-journey', 'routine', 'a', 'd001-vocabulary', '']) {
      expect(courseWordId(untouched)).toBe(untouched);
    }
  });

  it('lands every renamed word on a word of the course', () => {
    const bank = new Set(LOCAL_COURSE.vocabulary.map((word) => word.id));
    expect(LEGACY_WORD_IDS.size).toBe(12);
    for (const id of LEGACY_WORD_IDS) expect(bank.has(courseWordId(id))).toBe(true);
  });

  it('renames the words a saved Vocabulary quest has shown and the words answers picked', () => {
    const session = JSON.stringify({
      phase: 'practice',
      learnedItemIds: ['journey', 'habit'],
      answers: [
        { exerciseId: 'd001-vocab-1', optionId: 'goal', correct: false },
        { exerciseId: 'd001-vocab-2', optionId: 'journey', correct: true },
      ],
    });
    expect(JSON.parse(renameWordIdsInJson(session))).toEqual({
      phase: 'practice',
      learnedItemIds: ['vocab-journey', 'vocab-habit'],
      answers: [
        { exerciseId: 'd001-vocab-1', optionId: 'vocab-goal', correct: false },
        { exerciseId: 'd001-vocab-2', optionId: 'vocab-journey', correct: true },
      ],
    });
  });

  it('leaves grammar, reading and exam answers — options a…d — as they are', () => {
    const answer = JSON.stringify({ exerciseId: 'g1', optionId: 'b', correct: true });
    expect(renameWordIdsInJson(answer)).toBe(answer);
    const exam = JSON.stringify({ answers: [{ questionId: 'w12-v1', optionId: 'c' }] });
    expect(renameWordIdsInJson(exam)).toBe(exam);
  });

  it('is safe to run twice and on anything stored', () => {
    const once = renameWordIdsInJson(JSON.stringify({ learnedItemIds: ['goal'] }));
    expect(renameWordIdsInJson(once)).toBe(once);
    for (const stored of ['null', '42', '"journey"', 'not json', '{"optionId":7}']) {
      expect(renameWordIdsInJson(stored)).toBe(stored);
    }
  });
});
