import type {
  Achievement,
  AchievementId,
  AchievementUnlock,
  AnswerRecord,
  Chapter,
  ChallengeCompletion,
  CourseDay,
  CourseOutline,
  DayCompletion,
  DayNumber,
  Goal,
  JoinTeamResult,
  LearnedWord,
  LocalDate,
  LoginRequest,
  QuestCompletion,
  QuestContent,
  QuestSession,
  RegisterRequest,
  Team,
  TeamActivity,
  TeamInvite,
  TeamMember,
  Timestamp,
  UpdateProfileRequest,
  User,
  UserDto,
  ExamAttempt,
  FinalChallenge,
  ProgressMutation,
  ProgressMutationOf,
  ProgressMutationType,
  SyncResponse,
  WeeklyExam,
  XpEvent,
  XpEventReason,
} from '@/schemas';

/**
 * Data access contracts. Screens depend only on these, so a
 * `LocalCourseRepository` can later be swapped for an `ApiCourseRepository`
 * without touching the UI.
 */

/**
 * The course: what there is to learn. Every method is an async boundary —
 * the bundled course answers at once, an API-backed one from its cache or
 * the network — and every answer is validated content.
 */
export interface CourseRepository {
  /** The course's shape: identity and version, chapters, every day's quests — no material. */
  getCourse(): Promise<CourseOutline>;
  getChapters(): Promise<Chapter[]>;
  getDays(): Promise<CourseDay[]>;
  getDay(day: DayNumber): Promise<CourseDay>;
  /** A quest's playable content; `null` while the course has none for it yet. */
  getQuestContent(questId: string): Promise<QuestContent | null>;
  /** The checkpoint on a day, if the course has written it. */
  getWeeklyExam(day: DayNumber): Promise<WeeklyExam | null>;
  getFinalChallenge(): Promise<FinalChallenge | null>;
}

/** What onboarding writes when the challenge starts. */
export type ChallengeStart = {
  displayName: string;
  goal: Goal;
  /** Day 1. */
  challengeStartDate: LocalDate;
  onboardedAt: Timestamp;
};

export interface UserRepository {
  /** Returns the owner's profile, creating it (not onboarded yet) the first time. */
  getUser(): Promise<User>;
  updateDisplayName(displayName: string): Promise<User>;
  /** Takes the account's name and goal, where it has them. */
  adoptAccountProfile(profile: Pick<Account, 'displayName' | 'goal'>): Promise<User>;
  updateChallengeStartDate(date: LocalDate): Promise<User>;
  /**
   * Finishes onboarding and starts the challenge — once: a profile already
   * onboarded is returned unchanged, whatever `start` says. With an account,
   * `mutation` (the start, for the server) is stored in the same transaction.
   */
  completeOnboarding(start: ChallengeStart, mutation?: ProgressMutation | null): Promise<User>;
}

export interface ProgressRepository {
  getCompletions(): Promise<QuestCompletion[]>;
  getTotalXp(): Promise<number>;
  /**
   * Stores a quest's first completion — the completion, its answers and its XP —
   * in one transaction, and closes its session. When the quest is already
   * completed nothing but the session changes and it returns `false`: XP is
   * awarded once per quest, whatever the caller does. With an account,
   * `mutation` goes to the outbox in the same transaction — only with a first
   * completion.
   */
  recordFirstCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
    xp: XpEvent | null,
    mutation?: ProgressMutation | null,
  ): Promise<boolean>;
  /** Quests that were started but not finished. */
  getQuestSessions(): Promise<QuestSession[]>;
  saveQuestSession(session: QuestSession): Promise<void>;
  deleteQuestSession(questId: string): Promise<void>;
  addXpEvent(event: XpEvent): Promise<void>;
  /** Removes XP granted for one reason (e.g. when achievements are reset). */
  deleteXpEvents(reason: XpEventReason): Promise<void>;
  /**
   * Stores a finished day once. Returns `false` when the day was already
   * recorded — the first record stays, so a day can never complete twice.
   */
  recordDayCompletion(record: DayCompletion): Promise<boolean>;
  getDayCompletion(day: DayNumber): Promise<DayCompletion | null>;
  getDayCompletions(): Promise<DayCompletion[]>;
  /** Claims the day's celebration; only the first caller gets `true`. */
  markDayCelebrated(day: DayNumber, at: Timestamp): Promise<boolean>;
  /** Records learned words; a word already learned in that quest is ignored. */
  recordLearnedWords(words: readonly LearnedWord[]): Promise<void>;
  /** Different words learned, whichever quests taught them. */
  countLearnedWords(): Promise<number>;
  /** Removes completions, their answers, sessions, quest XP, learned words and the days they finished. */
  deleteCompletions(questIds: readonly string[]): Promise<void>;
  getCompletionsForDays(days: readonly DayNumber[]): Promise<QuestCompletion[]>;
  /** The summit, once reached (written by the Final Battle's submission). */
  getChallengeCompletion(): Promise<ChallengeCompletion | null>;
  /** Claims the summit's celebration; only the first caller gets `true`. */
  markChallengeCelebrated(at: Timestamp): Promise<boolean>;
  resetProgress(): Promise<void>;
}

export interface AchievementRepository {
  getDefinitions(): Promise<Achievement[]>;
  getUnlocks(): Promise<AchievementUnlock[]>;
  /** Unlocks ids that are not unlocked yet; returns the ones actually added. */
  unlock(ids: readonly AchievementId[], unlockedAt: Timestamp): Promise<AchievementId[]>;
  /** Marks unlocks as celebrated; returns the ones that were not yet (shown once, ever). */
  markCelebrated(ids: readonly AchievementId[], at: Timestamp): Promise<AchievementId[]>;
  lock(ids: readonly AchievementId[]): Promise<void>;
  resetUnlocks(): Promise<void>;
}

/** A submission, written in one transaction: never half-settled, whenever the app stops. */
export type ExamSubmissionWrite = {
  attempt: Pick<
    ExamAttempt,
    'id' | 'answers' | 'submittedAt' | 'correctCount' | 'score' | 'passed'
  >;
  /**
   * The exam quest's completion, when this submission finishes the quest —
   * stored by the first one only. `null` when it does not (a Final Battle
   * not passed yet).
   */
  completion: QuestCompletion | null;
  answers: readonly AnswerRecord[];
  /** The pass reward: paid if this exam's reward was never paid. */
  reward: XpEvent | null;
  /** The day the completion finishes, recorded with it. */
  day: DayCompletion | null;
  /** The summit — the Final Battle's first pass finishes the challenge. */
  challenge: ChallengeCompletion | null;
  /** With an account: the submission for the server, stored with it (only if it is submitted now). */
  mutation?: ProgressMutation | null;
};

export type ExamSubmissionOutcome = {
  /** `false` when the attempt was submitted already (a double tap): nothing changed. */
  submitted: boolean;
  rewardGranted: boolean;
  /** This submission completed the exam quest (the first one that finishes it). */
  firstCompletion: boolean;
  dayRecorded: boolean;
  challengeRecorded: boolean;
};

/** Weekly exam attempts, and the one-time reward for passing. */
export interface ExamRepository {
  /** Every attempt at an exam, the first first. */
  getAttempts(examId: string): Promise<ExamAttempt[]>;
  getAllAttempts(): Promise<ExamAttempt[]>;
  /** Opens a new attempt — unless one is open, which is then returned instead. */
  openAttempt(attempt: ExamAttempt): Promise<ExamAttempt>;
  /** Saves position and answers of an open attempt; `false` once it is submitted. */
  saveAttempt(
    attempt: Pick<ExamAttempt, 'id' | 'currentIndex' | 'answers' | 'updatedAt'>,
  ): Promise<boolean>;
  /**
   * Submits an open attempt and settles it at once: the pass reward (once per
   * exam, ever), the quest's first completion (which records the XP actually
   * paid; a later first pass adds its reward to it) with its day and — for the
   * Final Battle — the challenge, and the end of the quest's session. An
   * attempt submitted already changes nothing.
   */
  submitAttempt(submission: ExamSubmissionWrite): Promise<ExamSubmissionOutcome>;
}

/** An outbox entry as the development tools show it. */
export type OutboxEntry = {
  mutationId: string;
  /** `null` when the stored mutation cannot be read by this app. */
  type: ProgressMutationType | null;
  createdAt: Timestamp | null;
  status: 'pending' | 'rejected';
  attemptCount: number;
  lastAttemptAt: Timestamp | null;
  errorCode: string | null;
  errorMessage: string | null;
};

/** The server revision the account's copy on this device reflects. */
export type SyncState = { revision: number; syncedAt: Timestamp | null };

export type SyncApplied = {
  /** Anything the screens show changed. */
  changed: boolean;
};

/** Who got the device's progress from before accounts — decided once. */
export type LegacyClaim = {
  status: 'claimed' | 'skipped' | 'none';
  ownerId: string | null;
  mutationId: string | null;
  decidedAt: Timestamp;
};

export type LegacyClaimInput = {
  mutationId: string;
  courseId: string;
  courseVersion: number;
  timeZone: string;
  now: Timestamp;
};

/** An account's outbox and its copy of the server's progress, on this device. */
export interface SyncRepository {
  readonly owner: string;
  /** Mutations waiting for the server, oldest first. */
  pending(limit: number): Promise<ProgressMutation[]>;
  outbox(): Promise<OutboxEntry[]>;
  counts(): Promise<{ pending: number; rejected: number }>;
  state(): Promise<SyncState>;
  markAttempt(ids: readonly string[], at: Timestamp): Promise<void>;
  /** Sets aside a mutation no server will take as it is (the request itself was refused). */
  rejectLocally(mutationId: string, code: string, message: string): Promise<void>;
  /** Applies a server answer to the outbox and the projection, in one transaction. */
  apply(response: SyncResponse, at: Timestamp): Promise<SyncApplied>;
  /** Nothing of the account on this device yet. */
  isFresh(): Promise<boolean>;
  legacyClaim(): Promise<LegacyClaim | null>;
  /** Claims the device's progress from before accounts (see `SqliteSyncRepository`). */
  claimLegacy(input: LegacyClaimInput): Promise<ProgressMutation | null>;
  /** The first account here already has progress: the device's own stays unclaimed, for good. */
  skipLegacy(now: Timestamp): Promise<void>;
}

export type SyncReason =
  'launch' | 'signIn' | 'mutation' | 'foreground' | 'online' | 'retry' | 'manual';

/**
 * An account's progress sync, as the use cases meet it (`null` in local mode,
 * where there is no server): a way to write down an action for the server and
 * to wake the sync up. The sync itself runs elsewhere (`ProgressSyncEngine`).
 */
export interface ProgressSync {
  readonly accountId: string;
  readonly repository: SyncRepository;
  /** A new mutation, its id and time made here. Stored by the write that makes its progress. */
  mutation<Type extends ProgressMutationType>(
    type: Type,
    payload: ProgressMutationOf<Type>['payload'],
    now: Date,
  ): ProgressMutationOf<Type>;
  /** Asks for a sync soon. Returns at once; never throws. */
  requestSync(reason: SyncReason): void;
  /** For the engine that runs the sync: it hears the requests while it listens. */
  connect(listener: (reason: SyncReason) => void): () => void;
}

/**
 * The user's team. Local today (SQLite, demo data); an `ApiFriendsRepository`
 * can replace it without touching the UI. It serves what a server would: the
 * team and the *other* members as they share themselves — the user's own
 * progress stays local and is merged in by the use cases.
 */
export interface FriendsRepository {
  /** `null` while the user is on their own. */
  getMyTeam(): Promise<Team | null>;
  /** Everyone else in the team. */
  getTeamMembers(): Promise<TeamMember[]>;
  getMemberDetails(memberId: string): Promise<TeamMember | null>;
  /** Newest first. */
  getTeamActivity(limit: number): Promise<TeamActivity[]>;
  /** The team's invite, creating the team when the user is alone. */
  createInvite(now: Timestamp): Promise<TeamInvite>;
  /** Joining someone else's team needs a server: the local build never pretends. */
  joinTeam(code: string): Promise<JoinTeamResult>;
}

/**
 * Where the course in use came from — the copy downloaded from the API, or
 * the one bundled with the app — and a check for a newer one.
 */
export type CourseOrigin = {
  source: 'cache' | 'bundled';
  courseId: string;
  version: number;
  /** SHA-256 of the downloaded document; `null` for the bundled course. */
  contentHash: string | null;
  /** When the download was saved; `null` for the bundled course. */
  savedAt: Timestamp | null;
};

export type CourseUpdateResult =
  /** The saved copy is the server's current course. */
  | { status: 'current'; version: number }
  /** A newer course was downloaded, validated and saved: it is used from the next launch. */
  | { status: 'saved'; version: number }
  /** The server's course needs a newer app; the saved one stays. */
  | { status: 'unsupported'; schemaVersion: number }
  /** The download was broken or invalid; the saved (last known good) one stays. */
  | { status: 'rejected'; reason: string };

/** An API-backed course's updates. The course in use never changes under a running app. */
export interface CourseUpdates {
  origin(): Promise<CourseOrigin>;
  /** Asks the server for its current course. Network failures reject; bad content never does. */
  check(): Promise<CourseUpdateResult>;
}

/** The account on the Milo API, as this app knows it. */
export type Account = UserDto;

/**
 * Who is signed in. `local`: there is no backend and nobody to sign in — the
 * app is the device's own, as before accounts. `remote`: an account on the
 * Milo API, its tokens in the Keychain.
 */
export interface AuthRepository {
  readonly mode: 'local' | 'remote';
  /** The session saved on this device, read at launch; `null` when signed out. */
  restoreSession(): Promise<Account | null>;
  register(input: RegisterRequest): Promise<Account>;
  login(input: LoginRequest): Promise<Account>;
  /**
   * Ends the session on this device and, when it can be reached, on the
   * server. Nothing else is touched: progress stays on the device.
   */
  logout(): Promise<void>;
  /** The account from the server — which also proves the session still holds. */
  fetchAccount(): Promise<Account>;
  /** Only the profile fields the API accepts: the name and the goal. */
  updateProfile(update: UpdateProfileRequest): Promise<Account>;
  /** Called once when the server ends the session (expired, revoked or replayed). */
  onSessionEnded(listener: () => void): () => void;
}

/** Local-only operations used by the development tools. */
export interface DevRepository {
  /** Writes simulated history in one transaction (seeding 89 days one by one is slow). */
  seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
    days: readonly DayCompletion[],
    words: readonly LearnedWord[],
    challenge?: ChallengeCompletion | null,
  ): Promise<void>;
  /** Replaces the team (or removes it with `null`) in one transaction. */
  replaceTeam(
    team: Team | null,
    members: readonly TeamMember[],
    activity: readonly TeamActivity[],
  ): Promise<void>;
  /** A friend joining (the demo of what a server would push). */
  addTeamMember(member: TeamMember, activity: readonly TeamActivity[]): Promise<void>;
  /** Makes the profile new again: onboarding shows, its goal is cleared. */
  resetOnboarding(): Promise<void>;
  resetAllLocalData(): Promise<void>;
}

export type Repositories = {
  auth: AuthRepository;
  course: CourseRepository;
  /** Only present when the course comes from the API. */
  courseUpdates: CourseUpdates | null;
  user: UserRepository;
  progress: ProgressRepository;
  achievements: AchievementRepository;
  exams: ExamRepository;
  friends: FriendsRepository;
  /** An account's progress sync; `null` in local mode, where progress is the device's own. */
  sync: ProgressSync | null;
  /** Only for the device's own progress: never with an account, whose progress is the server's. */
  dev: DevRepository | null;
};
