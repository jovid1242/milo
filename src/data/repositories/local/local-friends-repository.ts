import type { LocalStore, SqlExecutor } from '@/data/db/local-store';
import type { FriendsRepository } from '@/data/repositories/types';
import { generateInviteCode, normalizeInviteCode } from '@/features/friends/logic/invite-code';
import {
  TeamActivitySchema,
  TeamMemberSchema,
  TeamSchema,
  type JoinTeamResult,
  type Team,
  type TeamActivity,
  type TeamInvite,
  type TeamMember,
  type Timestamp,
} from '@/schemas';

type TeamRow = { id: string; name: string; invite_code: string; created_at: string };
type MemberRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  joined_day: number;
  today_day: number | null;
  today_quests_done: number | null;
  total_xp: number | null;
  achievements_unlocked: number | null;
  last_activity_at: string | null;
  position: number;
};
type ActivityRow = {
  id: string;
  member_id: string;
  type: string;
  metadata_json: string;
  created_at: string;
};

const mapTeam = (row: TeamRow): Team =>
  TeamSchema.parse({
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  });

const mapActivity = (row: ActivityRow): TeamActivity =>
  TeamActivitySchema.parse({
    id: row.id,
    memberId: row.member_id,
    type: row.type,
    metadata: JSON.parse(row.metadata_json),
    createdAt: row.created_at,
  });

async function readMembers(db: SqlExecutor, owner: string, memberId: string | null = null) {
  const rows = await db.getAllAsync<MemberRow>(
    `SELECT * FROM team_members WHERE owner_id = ? ${memberId === null ? '' : 'AND id = ?'}
     ORDER BY position ASC`,
    memberId === null ? [owner] : [owner, memberId],
  );
  const days = await db.getAllAsync<{ member_id: string; day: number }>(
    'SELECT member_id, day FROM team_member_days WHERE owner_id = ? ORDER BY day ASC',
    [owner],
  );
  return rows.map((row) =>
    TeamMemberSchema.parse({
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      joinedDay: row.joined_day,
      completedDays: days.filter((day) => day.member_id === row.id).map((day) => day.day),
      today:
        row.today_day === null || row.today_quests_done === null
          ? null
          : { day: row.today_day, questsDone: row.today_quests_done },
      totalXp: row.total_xp,
      achievementsUnlocked: row.achievements_unlocked,
      lastActivityAt: row.last_activity_at,
    }),
  );
}

/** Shared with the dev repository, which writes demo teams. */
export async function writeTeamMember(
  db: SqlExecutor,
  owner: string,
  member: TeamMember,
  position: number,
) {
  await db.runAsync(
    `INSERT OR REPLACE INTO team_members
       (owner_id, id, display_name, avatar_url, joined_day, today_day, today_quests_done,
        total_xp, achievements_unlocked, last_activity_at, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      owner,
      member.id,
      member.displayName,
      member.avatarUrl,
      member.joinedDay,
      member.today?.day ?? null,
      member.today?.questsDone ?? null,
      member.totalXp,
      member.achievementsUnlocked,
      member.lastActivityAt,
      position,
    ],
  );
  await db.runAsync('DELETE FROM team_member_days WHERE owner_id = ? AND member_id = ?', [
    owner,
    member.id,
  ]);
  for (const day of member.completedDays) {
    await db.runAsync(
      'INSERT OR IGNORE INTO team_member_days (owner_id, member_id, day) VALUES (?, ?, ?)',
      [owner, member.id, day],
    );
  }
}

export async function writeTeamActivity(
  db: SqlExecutor,
  owner: string,
  activity: readonly TeamActivity[],
) {
  for (const item of activity) {
    await db.runAsync(
      `INSERT OR REPLACE INTO team_activity (owner_id, id, member_id, type, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [owner, item.id, item.memberId, item.type, JSON.stringify(item.metadata), item.createdAt],
    );
  }
}

export async function writeTeam(db: SqlExecutor, owner: string, team: Team) {
  await db.runAsync(
    'INSERT OR REPLACE INTO team (owner_id, id, name, invite_code, created_at) VALUES (?, ?, ?, ?, ?)',
    [owner, team.id, team.name, team.inviteCode, team.createdAt],
  );
}

export async function clearTeam(db: SqlExecutor, owner: string) {
  for (const table of ['team', 'team_members', 'team_member_days', 'team_activity']) {
    await db.runAsync(`DELETE FROM ${table} WHERE owner_id = ?`, [owner]);
  }
}

/**
 * The team, stored like cached server data. Everything a server would decide —
 * who is in the team, what they share — is only read here; the one local write
 * is creating the user's own team for an invite.
 */
export class LocalFriendsRepository implements FriendsRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async getMyTeam(): Promise<Team | null> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<TeamRow>('SELECT * FROM team WHERE owner_id = ? LIMIT 1', [
      this.owner,
    ]);
    return row ? mapTeam(row) : null;
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    return readMembers(await this.store.read(), this.owner);
  }

  async getMemberDetails(memberId: string): Promise<TeamMember | null> {
    const [member] = await readMembers(await this.store.read(), this.owner, memberId);
    return member ?? null;
  }

  async getTeamActivity(limit: number): Promise<TeamActivity[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<ActivityRow>(
      'SELECT * FROM team_activity WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?',
      [this.owner, limit],
    );
    return rows.map(mapActivity);
  }

  async createInvite(now: Timestamp): Promise<TeamInvite> {
    const team = await this.store.write(async (db) => {
      const existing = await db.getFirstAsync<TeamRow>(
        'SELECT * FROM team WHERE owner_id = ? LIMIT 1',
        [this.owner],
      );
      if (existing) return mapTeam(existing);
      const created = TeamSchema.parse({
        id: `team-${Date.parse(now).toString(36)}`,
        name: 'Our team',
        inviteCode: generateInviteCode(),
        createdAt: now,
      });
      await writeTeam(db, this.owner, created);
      return created;
    });
    // Nobody can join from another phone until there is a server to meet at.
    return { teamId: team.id, code: team.inviteCode, createdAt: team.createdAt, joinable: false };
  }

  async joinTeam(code: string): Promise<JoinTeamResult> {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return { status: 'invalidCode' };
    const team = await this.getMyTeam();
    if (team?.inviteCode === normalized) return { status: 'alreadyMember' };
    return { status: 'unavailable' };
  }
}
