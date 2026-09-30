# Progress sync

Progress belongs to the account and the **server owns it**. The phone keeps a **projection** of it
in SQLite — what the server confirmed, plus what it has not heard yet — and an **outbox** of what
the user did offline. The phone is never the source of truth and never a backup copy; it is also
never online-only: every screen reads SQLite, so the app works the same with or without a
connection.

The phone never tells the server what the user _earned_. It sends what the user _did_ — started
the challenge, answered a quest, handed in an exam — and the server decides from the course what
that was worth.

## Data flow

```
 play ─► use case ─► one SQLite transaction ─────────────► screens (React Query, invalidated)
         (quests,     • the projection (optimistic,
          exams,        rows marked "pending: mutation M")
          onboarding) • the outbox entry M
                                  │
                                  ▼  (on: mutation stored · sign-in · launch · foreground ·
                                  │   back online · "Sync now" · backoff retry)
                        ProgressSyncEngine (one per account, single-flight)
                                  │  POST /api/v1/progress/sync
                                  │  { userId, courseId, courseVersion, knownRevision, mutations[≤50] }
                                  ▼
                 ProgressService — per mutation, one PostgreSQL transaction:
                 lock the user row → seen before? (processed_mutations) → validate against the
                 published course → write facts (completion, attempt, words, day, XP ledger,
                 badges) → revision + 1 → record the outcome
                                  │
                                  ▼  { revision, results[], progress | null }
                 one SQLite transaction: acknowledged → out of the outbox, refused → marked;
                 the projection's confirmed rows := the server's; pending rows kept;
                 rows of finished mutations the server did not make → dropped; revision saved
```

### Where the progress domain was changed

Every write of progress the app had before this stage, and what it is now:

| Write (before)                                                   | Now                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `completeOnboarding` — challenge start date                      | + outbox `startChallenge {courseId, startDate, timeZone}`, same transaction |
| `recordFirstCompletion` — completion, answers, quest XP          | + outbox `completeQuest {questId, courseVersion, answers, completedAt}`     |
| `recordLearnedWords`, `recordDayCompletion`                      | derived: marked pending while the outbox has anything; the server derives   |
| `syncAchievements` — unlocks + badge XP                          | derived, the same; the server evaluates the same rules                      |
| `submitAttempt` — attempt, pass reward, completion, day, summit  | + outbox `submitExam {questId, attemptId, answers, submittedAt}`            |
| `markCelebrated`, `markDayCelebrated`, `markChallengeCelebrated` | this phone only (a moment shown once here)                                  |
| quest sessions, open exam attempts                               | this phone only (where the user is inside a quest)                          |
| dev tools: seed history, shift the day, add XP, resets           | local mode only — hidden with an account                                    |

## Source of truth

| Field                                                                               | Truth                | Notes                                                                               |
| ----------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| challenge start date + time zone, started at                                        | **server**           | `user_challenges`; a challenge starts once — the first start stands                 |
| current day                                                                         | **derived**          | from start date and today (server: in the challenge's zone; phone: device calendar) |
| quest completions, their score and XP                                               | **server**           | scored from the answers against the published course                                |
| completed days, day records, streak before/after                                    | **server**           | written in the transaction of the day's last quest                                  |
| streak                                                                              | **derived**          | the app's rule over completed days and the current day — never stored               |
| total XP, level                                                                     | **derived**          | sum of the append-only XP ledger (one entry per reward)                             |
| learned words                                                                       | **server**           | once per word id                                                                    |
| exam attempts, pass, reward, summit                                                 | **server**           | the server scores the answers                                                       |
| achievement unlocks + their XP                                                      | **server**           | the app's rules, evaluated after every accepted mutation                            |
| display name, goal                                                                  | **server** (account) | `users` (from Foundation); onboarding fills it                                      |
| the projection in SQLite                                                            | client cache         | server rows + rows waiting for the server                                           |
| outbox, revision, sync status                                                       | client only          |                                                                                     |
| celebrations shown, quest in progress, open exam attempt, answers before completion | client only          | per device by design                                                                |
| sound, haptics, reminders settings                                                  | client only (device) |                                                                                     |

## Server tables (PostgreSQL, `server/prisma`)

- `user_challenges` — `userId`, `courseId` (unique together), `startDate` (date), `timeZone`,
  `startedAt`, `completedAt` + `finalAttemptId` (the summit), `revision`. No totals, no streak, no
  current day: all derived.
- `quest_completions` — unique `(challengeId, questId)`; day, type, course version, correct/total,
  `xpEarned`, `answers` (JSON, the learning record), `completedAt` (device time, never later than
  `recordedAt`), `recordedAt`, `mutationId`.
- `day_completions` — primary key `(challengeId, day)`; quests, XP, streak before/after, perfect.
- `learned_words` — primary key `(challengeId, wordId)`.
- `exam_attempts` — unique `(challengeId, attemptId)` and `(challengeId, examId, number)`; answers,
  correct/total, passed.
- `xp_ledger` — append-only; unique `(challengeId, reason, refId)`: a reward cannot be paid twice.
- `achievement_unlocks` — primary key `(challengeId, achievementId)`.
- `processed_mutations` — primary key `(userId, mutationId)`; type, SHA-256 of the mutation,
  outcome (`accepted` / `rejected` + code), the revision after it.
- CHECK constraints: positive ledger amounts, `0 ≤ correct ≤ total`, `streakAfter = streakBefore + 1`,
  a rejection has a code, revisions never negative. Timestamps are `timestamptz` (UTC instants).

## Local SQLite (migration 12)

Every table of progress got `owner_id` in its key: `user_profile`, `quest_completions`, `answers`,
`quest_sessions`, `xp_events`, `achievement_unlocks`, `day_completions`, `learned_words`,
`exam_attempts`, `challenge_completion`, and the team tables. Rows the server has not confirmed
carry `pending_mutation_id`. New tables: `outbox`, `sync_state` (the revision each account's copy
reflects), `legacy_claim`. `course_cache` stays the device's. Tables were rebuilt (SQLite cannot
change a primary key) inside the migration's transaction; every existing row became `local`'s.

Repositories are created **per owner** (`repositoriesFor(device, owner)`), and every statement is
scoped by it: another account gets other instances and cannot reach a row of this one.

## Accounts on one phone

- An **owner session** (`services/session/owner-session.ts`) is an owner's repositories, a React
  Query client of its own and — with an account — its sync engine. Signing out disposes it: the
  engine stops first (nothing more is sent), the cache is dropped.
- `AppProviders` keys the whole tree by the owner: a new owner remounts every screen with an empty
  cache, so account B cannot see a frame of account A.
- Signing in waits (briefly) for the account's progress from the server, so a second phone never
  shows onboarding to someone halfway through.
- Signed out, there is no progress at all — the repositories without an owner throw if touched.
- An account's outbox is only ever sent as that account: the engine checks that the signed-in
  account is its own before every request (and stops otherwise), and the server refuses a request
  whose `userId` is not the token's (`409 ACCOUNT_MISMATCH`).
- An account's rows stay on the phone after logout, out of sight; signing in again shows them at
  once, even offline, and sends whatever still waits.

## Progress from before accounts (legacy)

Everything on the phone before this migration — and everything in local mode — is owned by
`local`. The rule, decided once per phone and recorded in `legacy_claim`:

- The **first account that signs in** after the update decides it, and only on the server's word
  (never offline).
- If that account has **no progress anywhere** (none on the server, none on this phone) and the
  phone has a started challenge, the phone's progress is **claimed**: copied to the account (the
  originals stay untouched, owned by nobody) and sent as one `importLegacyProgress` mutation — the
  start date and what was played (answers, not results). The server accepts it only for an account
  without a challenge, replays every quest and exam through its normal rules (scoring, locks,
  rewards once, badges) but without the sync window — it is history — and leaves out what does not
  pass (quests finished by development shortcuts have no answers).
- If that account **already has progress**, nothing is merged into it — two histories are never
  mixed — and the phone's progress stays unclaimed for good.
- No second account ever gets it.

## Protocol

`GET /api/v1/progress` → `{ revision, progress }`.

`POST /api/v1/progress/sync` → `{ revision, results, progress | null }`:

- `mutations`: at most 50, oldest first, applied in order. Each is
  `{ id (UUID made on the phone), type, createdAt (metadata), payload }` validated by the shared
  Zod schemas (`src/schemas/progress-sync.ts`); unknown fields are refused.
- `results`: one per mutation — `accepted` (applied; it may have changed nothing),
  `duplicate` (this id was applied before: a retry), `rejected` + `code` (final).
- `progress`: the whole account progress when `revision` moved past `knownRevision`, else `null`.
- `409 COURSE_VERSION_UNSUPPORTED` / `COURSE_MISMATCH`: nothing is applied; the phone keeps its
  outbox whole and waits (no retry loop). `409 ACCOUNT_MISMATCH`: the phone stops that sync.
- The body limit on this route is 1 MB (a legacy import can be large); elsewhere 100 kB.

## Idempotency

- Every mutation id is recorded with its outcome in the same transaction as its effects: a retry
  gets `duplicate` and changes nothing; the same id with other content gets
  `MUTATION_ID_REUSED`.
- Domain operations are idempotent in themselves: a quest completes once (a second mutation for it
  is accepted and changes nothing), a day completes once, a reward is paid once (unique ledger
  key), a badge unlocks once, an attempt is recorded once, the summit is reached once.
- Mutations of one user are serialized by a row lock on the user: two phones syncing at the same
  moment take turns.
- A failed transaction leaves nothing — not even its record — so the retry is simply applied.

## Revision

`user_challenges.revision` goes up by one with every mutation that changed something; duplicates,
refusals and no-op mutations leave it. The phone stores the revision its copy reflects and sends
it; the server answers with the progress only when it moved. After a refusal the phone asks once
more with revision 0 for the whole progress, to undo any optimistic change on a confirmed row.

## Rules the server applies

- **Availability:** a day's quests are played on that day, in order. Day _N_ is accepted when the
  server's day (in the challenge's time zone) is at most `N + 7` (a week offline still counts) and
  at least `N − 1` (time zones, clock drift). The first attempt at an exam also needs its day's
  warm-up; retakes are always open (as in the app).
- **XP:** a quest pays its `xpReward` + 10 for no mistakes (`questReward`); a weekly exam or the
  Final Battle pays its reward on its first pass; badges pay their reward. All through the ledger,
  once each.
- **Scoring:** from the answers, against the published course: every exercise answered once with
  one of its options (`scoreQuestAnswers`), exams by `scoreExam` — the same functions the app uses.
  `src/features/progress/logic/__tests__/quest-scoring.test.ts` proves the server scores exactly
  the exercises each quest screen plays.
- **Day completion, streak:** `buildDayCompletion` and `computeStreak`, unchanged. The streak is
  derived from completed days and today; a missed day breaks it.
- **Achievements:** `buildAchievementFacts` + `findNewlyEarned`, unchanged. The team badge needs
  Friends, which the server does not have yet: it stays locked (the app does the same with an
  account).
- **Time:** the server's clock decides availability; device timestamps are kept for display only
  (never later than the server's receipt) and never used for XP or streaks.

## Course versions

Every quest and exam mutation names the course version it was played on. The server checks
progress against the course it publishes; a version it cannot check is refused as a whole request
(`COURSE_VERSION_UNSUPPORTED`) and the outbox waits, whole and in order.

## Conflicts and several phones

No last-write-wins anywhere: every operation is a fact the domain merges.

- The same quest on two phones: the first to arrive counts, the second is accepted and changes
  nothing; XP is paid once.
- Different quests on two phones: both count (in each day's order).
- Two onboarding starts: the first start stands; the second phone's copy takes the server's date.
- Every phone ends with the same progress once it has synced (tested with two real phones'
  worth of app code against the real server).

## Offline

Everything is written locally first; the screens update at once. The outbox survives restarts.
Offline, the engine does not try; back online (or foreground, or a new mutation) it sends
everything in order. Network failures back off exponentially (2 s … 5 min, jittered); when the
server cannot read a request, changes go one at a time until the one it cannot read is found and
set aside. Refused
mutations are never retried — they stay in the outbox, marked, for inspection — and the progress
they showed is taken back. Home shows a quiet note while progress waits offline.

## Celebrations

A moment plays on the phone where it happened, once. Rows confirmed by the server keep the
phone's `celebrated_at`; rows new to the phone (earned on another phone, or the server's own
derivation) arrive marked celebrated — no surprise popups, no second celebration.

## Development tools (with an account)

Account id, server revision, waiting and refused changes, sync state, last sync and last try,
the last error; **Sync now** and **Inspect outbox**. Nothing in the tools writes an account's
progress — the progress shortcuts work in local mode only.

## Observability

One log line per sync (`msg: "Progress sync"`): request id, user id, course version, mutation
count, accepted / duplicate / rejected (+ rejection codes), revision before and after, whether a
snapshot was sent, duration. Never answers, never tokens.

## Known limitations

- The server keeps only the course it publishes: a phone with outbox entries from an older course
  version is blocked until the server can check that version (keep old versions' documents on the
  server while phones may hold them).
- Play older than a week (by the server's clock) cannot be told from a clock turned back, and is
  refused. Within the window, a phone whose clock was set back could still finish a missed day.
- The whole progress is sent when the revision moves (≈150–200 KB of JSON at Day 90, not
  compressed yet); deltas are a later optimisation.
- A legacy import trusts the phone's claim of when history happened (not what it earned).
- A celebration earned from another phone's progress is not shown on this one.
