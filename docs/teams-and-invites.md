# Teams and invites

A Milo team is up to **three friends** taking the same 90-day challenge. It is not a social
network: no feed, no chat, no reactions, no public groups — only how each member's day goes and
the team streak. The Milo API owns everything about it; the phone shows the server's last answer
and keeps it for when it is offline.

## Rules

| Rule                | What it means                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capacity            | Three members (`TEAM_CAPACITY`). A team of three is **full**: it hands out no invite and takes nobody else.                                                                                                  |
| One team per person | A user is in at most one team (`team_members.userId` is unique). To join another team, leave the current one first (`ALREADY_IN_TEAM`).                                                                      |
| A started challenge | Making or joining a team needs a started challenge (`CHALLENGE_NOT_STARTED`): the team's progress is its members' challenges.                                                                                |
| Making a team       | Deliberate: "Create team" on the Friends tab. Nothing makes a team by itself. The maker is its **owner** and first member.                                                                                   |
| Joining             | Only with a valid invite, and only after the user saw the team and tapped **Join team** — a link never joins by itself.                                                                                      |
| Ownership           | One owner per team (a partial unique index). An owner who leaves hands the team to the member who **joined earliest**; nobody is ever asked to transfer it by hand.                                          |
| Leaving             | Any member can leave at any time. The invites the leaver made stop working (`revokedReason = creatorLeft`). The **last** member to leave deletes the team, with its invites: no empty teams are left behind. |
| Removing members    | Not in this version: nobody can remove anyone else.                                                                                                                                                          |

## Invites

- **The code:** 10 characters in two groups, `7K2PX-9QDMA`, from 32 characters that cannot be
  mistaken for each other (no `0/O`, no `1/I`) — **50 bits**. It is read case-insensitively,
  with or without the dash and spaces, and a pasted link works as well as the code.
- **The link:** `milo://invite/7K2PX-9QDMA` — Expo Router maps it to `app/invite/[code].tsx`
  (the app's scheme is `milo`). There is no web domain yet, so no universal link.
- **Share:** the system share sheet (`Share.share`) with a short invitation, the link and the
  code; no SMS or messenger SDK.
- **One open invite per team:** "Invite friends" asks the server for the team's invite — the open
  one while it has a day or more left, otherwise a new one. Every member gets the same code; the
  one-member Friends card shows it too.
- **Lifetime:** 7 days (`INVITE_TTL_DAYS`). It works **for as many people as the team has room
  for** — so at most two joins — until it expires, is turned off, or its maker leaves. There is no
  single-use state: a full team is the limit (`TEAM_FULL`), and a team that gets a place back
  (someone left) can use its open invite again.
- **Turning it off:** **New code** in the invite sheet turns the current invite off (a `DELETE`
  of `/team-invites/:id`) and makes a new one. Only whoever made an invite, or the owner, can
  turn it off (`FORBIDDEN` otherwise).
- **Refusals** — each with its own code and words, never a generic error: `INVITE_INVALID` (404:
  no such code), `INVITE_EXPIRED` (410), `INVITE_REVOKED` (410), `TEAM_FULL` (409),
  `ALREADY_MEMBER` (409), `ALREADY_IN_TEAM` (409), `CHALLENGE_NOT_STARTED` (409), `RATE_LIMITED`
  (429).

### Invite security

- **Never stored, never logged.** The server derives an invite's code from its id with a key of
  its own (HMAC-SHA256; the key is derived with HKDF from `REFRESH_TOKEN_SECRET`, so there is
  nothing new to configure) and finds the invite by the code's keyed hash (`codeHash`). A copy of
  the database holds no code that works. Logs carry the invite's id, never its code; the code
  travels in request **bodies**, never in a URL, where request logs and proxies would keep it.
- **Guessing:** 2⁵⁰ codes, only signed-in accounts can try, previews and joins are limited per
  account (`INVITE_RATE_LIMIT`, default 10 a minute; sign-ups are limited per address), and a code
  lives 7 days. A found code only lets someone into a team that has room — never someone's
  progress before joining.
- **On the phone:** an invite opened before sign-in waits in the **Keychain**
  (`stores/pending-invite-store.ts`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) for at most the
  invite's lifetime, and is cleared once shown.

## Deep link and the invite page

```
milo://invite/<code>  →  app/invite/[code].tsx  (reachable signed in or out)
  signed out         → "You're invited to a Milo team" → Sign in / Create account
                        (the code waits in the Keychain)
  signed in, new     → "Start your challenge first" → onboarding (the code waits)
  in the challenge   → preview: "Ada's team · 2/3 members" → Join team / Not now
```

`PendingInviteWatcher` (in the root layout) opens a waiting invite as soon as the user is signed
in and in the challenge — after sign-in, after sign-up and onboarding, after a restart in between.
The page shows the team's name, its owner's name and how many are in it — nobody's progress —
and what joining would mean for the user (`canJoin`, `full`, `alreadyMember`, `inAnotherTeam`).
**Join with a code** on the Friends tab opens the same page for a typed or pasted code.

## Team streak

Computed by the server (`src/features/friends/logic/team-streak.ts`, shared with the app's code)
from its own day records whenever it is needed — never stored, never sent by a phone:

- A **team day** is a calendar date on which every member who had joined by then finished their
  challenge day for that date — and there were **at least two** of them. The rule is the one the
  app's team had before the server (`joinedDay <= day`, two or more members), now on dates.
- **Two members are enough.** A team of three is the goal; the streak starts with two, and a third
  member counts from the day they join.
- **Members count from the day they join** — the days before are not theirs to finish. Someone who
  joins late in the evening is asked for that day too (as before): the "N of 3 finished today"
  line and the streak agree on who counts.
- **Own calendars.** Each member's dates are in their challenge's time zone, and their challenge
  day for a date follows from their own Day 1 — members who started on different dates line up by
  date, not by day number.
- **Leaving:** only the team as it is now counts. A member who left no longer counts, for or
  against, on any day.
- **The streak** is the team days in a row up to today — or up to yesterday while today is still
  open, like a personal streak; the longest run is kept too. The viewer's date is theirs.
- The phone shows the server's streak. When the user's own last quest completes today's team day
  before the server has heard of it, the day is shown at once (+1), and the server confirms it
  with the sync.

## Team Streak badge

- **Earned on the server only.** `ChallengeWork.settleAchievements` gets the team's streak (the
  roster from PostgreSQL, the user's own days as the mutation leaves them); the badge unlocks when
  the longest team run reaches 7 — with its 100 XP, once (`achievement_unlocks` and the XP ledger
  are unique per badge). A phone never unlocks it with an account (`syncAchievements` leaves it
  out); in local mode, where there is no server, the dev tools' demo team can unlock it locally.
- **Every member gets it.** The mutation that completes the seventh day unlocks it for its user;
  the others get it on their next sync — every sync checks the team (`settleTeamBadge`), even one
  with nothing to send. Unlocks granted this way have no mutation (`mutationId` is `NULL`).
- **Celebrated once.** A badge the server sends to a phone arrives as already celebrated (it was
  earned elsewhere) — except the team badge on a phone that already follows the account: nobody
  there has seen it yet, so it arrives uncelebrated and `AchievementCelebrationHost` shows it
  once; later syncs never reset it. On a phone signing in for the first time it is history, and
  does not pop up.

## What members see of each other

`TeamMemberSummary` (`src/schemas/team.ts`), derived by the server from its own progress records:
`userId`, `displayName`, `avatarUrl` (initials until pictures exist), `role`, `joinedAt`,
`currentDay` (their own), `todayCompleted`, `todayQuestsDone`, `streak`, `totalXp`,
`daysCompleted`, `achievementsUnlocked`, `lastActivityAt`. Never an email, auth data, answers,
the outbox, the list of days or quests, or settings — counts, not records. A phone cannot claim
XP or a streak: the numbers come from the XP ledger and the day records, which only the server's
scoring writes.

## API (`/api/v1`, all signed in)

|                                  |                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /teams/me`                  | `{ team: TeamSnapshot \| null, asOf }` — members, the team streak, the open invite              |
| `POST /teams`                    | a new team, the caller its owner (201)                                                          |
| `POST /teams/:teamId/invites`    | `{ invite }` — the team's open invite, or a new one (members only; `TEAM_FULL` for a full team) |
| `DELETE /team-invites/:inviteId` | turn an invite off (204; its maker or the owner)                                                |
| `POST /team-invites/preview`     | `{ code }` → `{ preview }`: team name, owner name, member count, status — rate-limited          |
| `POST /team-invites/join`        | `{ code }` → the team with the caller in it — rate-limited                                      |
| `POST /teams/:teamId/leave`      | 204; ownership passes on, the last member deletes the team                                      |

A team id the caller is not a member of answers `TEAM_NOT_FOUND` (404) — the same as one that
does not exist.

### Capacity under concurrency

Every change of a team's membership takes the team's row lock (`SELECT … FOR UPDATE`) — joins
take turns, and the fourth finds the team full. Joins and leaves lock the user's row first (the
same lock progress sync uses), always in the order user → team, so they cannot deadlock. The
database holds the line as well: `team_members.slot` is 1–3 and unique within a team, `userId` is
unique, one owner per team. Tests: two people joining the last place at once → exactly one gets
it, the other `TEAM_FULL`; ten at once for two places → exactly two.

### Logs

`Team created`, `Invite created`, `Invite revoked`, `Invite preview` (refusals), `Team join`
(`outcome: joined | rejected`, `reason`), `Team left` (`members`, `teamDeleted`, `ownerNow`),
`Team badge` — with team, invite and user **ids** only: never an email, a code, a token or
anyone's progress.

## On the phone

- **Repository:** `FriendsRepository` (`data/repositories/types.ts`) — `cached`, `refresh`,
  `create`, `invite`, `revokeInvite`, `preview`, `join`, `leave`. `ApiFriendsRepository` is the
  one used with an account (HTTP via `HttpTeamApi`); `LocalFriendsRepository` in local mode,
  where there is no server (changes are refused with "Teams need Milo online"). Screens use the
  hooks in `features/friends/queries.ts`, never `fetch`.
- **Cache:** the server's last answer per account (`team_cache`, SQLite migration v13 — the old
  local demo tables are gone). `useTeam` shows it at once, merged with the user's own progress,
  and asks the server in the background: on mount, every minute on screen, on returning to the
  foreground, after the user's own progress syncs, and as soon as the connection is back (paused
  while offline). No CRDT, nothing merged: the answer replaces the cache.
- **Offline:** the Friends tab shows the last team with a note saying it is not fresh ("You're
  offline" or "Milo's server can't be reached right now", and since when); making, joining,
  inviting and leaving show **Internet connection required**. Nothing is queued: team actions are
  never in the progress outbox.
- **Accounts:** the cache is scoped by owner, the query cache is per account, and an answer that
  does not have the account in it is refused (`ACCOUNT_MISMATCH`) — one account's team never shows
  under another, not even for a frame.
- **UI states:** no team (Create team / Join with a code), 1/3 (the code to share), 2/3, 3/3
  (full), offline with the last team, the invite page, and every refusal in words.

## Known limitations

- No universal link (`https://…/invite/…`) yet: the custom-scheme link opens Milo when it is
  installed; a messenger may not make it tappable, so the share text carries the code too.
- A pending invite waits on one device; an invite opened on another device is not carried over.
- Celebration state is per device: the team badge is celebrated once on each phone that followed
  the account when it arrived.
- Team days use each member's own calendar, so friends far apart in time zones see today's team day
  close at different hours.
- Only days 1, 2, 7, 89 and 90 of the course have content: the server tests put the records of days
  3–6 in place to test a seven-day team streak.
- Members cannot remove each other, rename the team, or add a picture.
