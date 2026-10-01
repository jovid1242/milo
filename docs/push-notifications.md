# Team notifications (push)

Milo tells a team what its members do: someone joined, someone finished today, it is your turn,
the team day is complete, a team streak milestone. The **Milo API** decides what to send and
when; **Expo's push service** hands it to **Firebase Cloud Messaging (FCM V1)**; the phone shows
it. **Android only** for now: iOS needs an Apple Developer account and APNs keys first.

The **Daily Reminder is not a push**. It stays a local notification, planned and scheduled on the
phone (`features/reminders`), with no server and no network. The two work independently; they
share only the phone's notification permission.

## Architecture

```
Milo (Android build) ──── expo-notifications: permission, Expo push token, channel, taps
   │ PUT /push/devices/current  { token, platform }        (signed in: the session's device)
   ▼
Milo API (NestJS · PostgreSQL · Prisma)
   progress sync / team join ──► push_jobs  (the outbox: same transaction as the change)
   PushWorker ──► POST https://exp.host/--/api/v2/push/send   (≤ 100 messages a request)
                  tickets ─(15 min)─► /getReceipts              (a device that is gone is forgotten)
   ▼
Expo Push Service ──► FCM V1 ──► the phone (channel "team-updates")
```

- **No Firebase Admin SDK on the server**, and no Firebase credentials in the repository. Expo
  talks to FCM with the FCM V1 service-account key the owner uploads to **EAS credentials**.
- **No Redis**: PostgreSQL is the queue (`FOR UPDATE SKIP LOCKED`).
- **Transactional outbox**: news is written in the transaction of the change it is about — the
  finished day, the join — so it commits with it or not at all. The worker sends it after the
  commit. A crash can never lose news for a committed change, or send news about a change that
  rolled back.

## What is sent

| Kind                        | When                                                    | Who hears it                           | Words (title · body)                                                  | Opens     |
| --------------------------- | ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- | --------- |
| `TEAM_MEMBER_JOINED`        | someone joins with an invite                            | the members already in, not the joiner | "Bea joined your team" · "Climb the 90 days together — …"             | Friends   |
| `TEAM_MEMBER_COMPLETED_DAY` | a member finishes **today's** day, for the first time   | the other members                      | "Ada finished today" · "1 of 3 finished today. Everyone’s moving."    | Friends   |
| `TEAM_YOUR_TURN`            | everyone but one has finished today                     | only the one still to finish           | "One more to go" · "2 of 3 are done — your turn!" ("Ada is done — …") | **Today** |
| `TEAM_DAY_COMPLETE`         | the last member finishes: the team day is complete      | everyone but the one who completed it  | "Team day complete" · "Everyone finished today. Team streak: 4 days." | Friends   |
| `TEAM_STREAK_MILESTONE`     | that team day makes a streak of **7, 14, 30, 50 or 90** | everyone but the one who completed it  | "7-day team streak!" · "Everyone finished 7 days in a row. Keep …"    | Friends   |

- **The member whose action it is never hears of it**: they are in the app, and it shows there.
- **Today only.** A day played offline and synced later is old news: nothing is sent. "Today" is
  the finisher's calendar date (their challenge's time zone); "your turn" goes only to a member
  whose own date is that date too — someone already past it, or not there yet, cannot finish it.
- **Who counts** is the team streak's own rule (`logic/team-streak.ts`): members who joined by
  that date, two at least. The streak in the words is the server's, as the Friends tab shows it.
- No achievement pushes; no pushes about anything but the team.

## One notification per person per action

**Priority.** For one recipient, a team day's news only goes up:
`MEMBER_COMPLETED_DAY (1) < YOUR_TURN (2) < DAY_COMPLETE (3) < STREAK_MILESTONE (4)`.

- Each action gives each recipient **one** piece of news at most — the most important one:
  the last finish makes it "team day complete" (or the milestone) for everyone else, never also
  "Ada finished today"; the next-to-last finish gives the last member "your turn", never also
  "… finished today".
- News still **waiting** gives way to more important news about the same team and day
  (`cancelled`, reason `superseded`): whoever gets "your turn" a second after "Ada finished
  today" was queued gets only "your turn".
- Lesser news is never queued after more important news about the same day.
- A member who finishes has their own waiting "your turn" cancelled (reason `done`).

**Deduplication.** Every job has a unique `dedupeKey` naming the event for its recipient, and the
insert skips duplicates (`ON CONFLICT DO NOTHING`):

| Kind                     | Key                                             | Meaning                               |
| ------------------------ | ----------------------------------------------- | ------------------------------------- |
| joined                   | `joined:<team>:<joiner>:<UTC date>:<recipient>` | a leave-and-rejoin the same day: once |
| member finished          | `member-day:<team>:<date>:<member>:<recipient>` | once per member, team, day            |
| your turn                | `your-turn:<team>:<date>:<recipient>`           | once per team, day, recipient         |
| day complete / milestone | `team-day:<team>:<date>:<recipient>`            | **exactly once per team day**         |

On top of that, the progress sync itself is idempotent: a retried mutation is a `duplicate`, a
quest played again is not a new day. A repeated sync never makes news.

**Concurrency.** Two members finishing at the same moment take turns on the team's row
(`SELECT … FOR UPDATE`), after their own user row — the order every team change locks in — so
exactly one of them completes the team day. User rows are locked `FOR NO KEY UPDATE`: writes of a
user still take turns, while a teammate's transaction can still queue news pointing at that user
(a `FOR UPDATE` there deadlocked two members finishing together; the tests race it).

## The worker

`PushWorker` (`server/src/push/push-worker.ts`) runs in the API process when `PUSH_ENABLED` and
`PUSH_WORKER_ENABLED` are on. Every 3 seconds:

1. **Claim** up to 100 due jobs in one statement (`SKIP LOCKED`) as `sending`, with a
   one-minute lease and one more attempt. Two workers (two API processes) never claim the same
   job. A worker that dies mid-send lets its jobs go when the lease passes — another worker sends
   them.
2. **Check** each job: expired (`expired`), the recipient is no longer in that team
   (`notMember`), no device of a live session (`noDevice`) → `cancelled`, not sent.
3. **Send** one message per device of the recipient, whole jobs per request, at most 100 messages
   a request: channel `team-updates`, `priority: high`, `ttl` = the job's remaining lifetime (FCM
   drops it for a phone that stays offline longer).
4. **Tickets.** The job is `sent` once Expo accepted a message for it — which is **not delivery**.
   Each ticket is kept, and its **receipt** checked after 15 minutes (receipts in batches of 300;
   one never ready is dropped after a day). `DeviceNotRegistered` — in a ticket or a receipt —
   deletes the device.
5. **Failures.** No answer, `429` or `5xx`: the job waits and is tried again, backing off
   10 s → 20 s → 40 s … (15 min at most, spread a little per job; Expo's `Retry-After` honoured),
   six tries at most, never past its expiry. Any other `4xx` (bad credentials, a refused message):
   `failed` at once. A ticket's `MessageRateExceeded` counts as "later".
6. **Pruning** (hourly): finished jobs after 7 days, tickets after a day, devices of sessions that
   ended without a logout (expired, or revoked for a replayed refresh token).

News lives until the end of the recipient's day (12 hours at most); a new teammate, a day. Old
news is never sent late.

**At least once.** The one duplicate the design allows: a worker that crashes after Expo accepted
a request and before it recorded that — its jobs are sent again when the lease passes. The window
is the time between Expo's answer and one `UPDATE`.

## Devices and tokens

A **device** is a signed-in session that turned Team notifications on: `push_devices` holds the
user, the session (unique), the Expo push token (unique) and the platform — nothing else.

| Rule                | How                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only for the caller | `PUT /push/devices/current` needs a live session; the device is that session's, for that session's user.                                                                  |
| Upsert, idempotent  | the same token again for the same session only confirms it (`updatedAt`).                                                                                                 |
| Token rotation      | a new token for the session replaces its old one.                                                                                                                         |
| Several devices     | one per session: phone and tablet each get the news. Ten per person at most (the least recently seen go).                                                                 |
| Account switch      | a token registered by another session — another account on the same phone — **moves**: deleted and created anew, so nothing queued for the previous account can reach it. |
| Logout              | ends the session and deletes its device, in one transaction; a replayed refresh token does the same.                                                                      |
| Sessions            | the worker sends only to devices of live sessions (not revoked, not expired).                                                                                             |
| Offline sign-out    | the phone keeps the token to forget and tells the server as soon as it can: `POST /push/devices/unregister`.                                                              |

| Endpoint                        | Auth      |                                                                                         |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `PUT /push/devices/current`     | signed in | `{ token, platform }` → 204. `400` for anything but an Expo push token.                 |
| `DELETE /push/devices/current`  | signed in | 204: this device gets nothing more.                                                     |
| `POST /push/devices/unregister` | none      | `{ token }` → 204 whether or not it was known; limited per address (`AUTH_RATE_LIMIT`). |

## On the phone

- **Settings → Team → Team notifications** (`features/push`), shown only with an account on an
  Android build of Milo (not Expo Go, not iOS). The daily reminder keeps its own switch; either
  works without the other.
- **Permission — only from the switch, never at launch.** The same flow as the daily reminder
  (`reminders/logic/permission.ts`): already allowed → on; not asked yet → a word first
  ("News from your team"), then the system dialog; refused → "stays off"; refused for good →
  "Open Settings". Then: the `team-updates` channel, the Expo push token (`getExpoPushTokenAsync`
  with the EAS project id), `PUT /push/devices/current`. **On only once the server has it**;
  offline or refused → off, with a word.
- **`PushSync`** (root layout, renders nothing) keeps the server true to the switch and to who is
  signed in — at launch, on returning to the app, when the push token changes and when the
  connection is back. A registration that is not the signed-in account's is released at once: its
  token is forgotten on the server, or kept (in the Keychain) until it can be — after a restart
  too. Everything runs one step at a time, so forgetting a token never overtakes the next account
  registering the same one. A permission taken away in Android settings turns the switch off, as
  it does the reminder's.
- **Per account, per device**: Ada's choice waits for Ada on this phone; Bea signing in on it starts
  with the switch off.
- **Taps**: team news opens the Friends tab (`app/(tabs)/friends.tsx`), "your turn" opens Today
  (`app/(tabs)/index.tsx`) — with Milo open, in the background, or launched by the tap. The
  listener is subscribed first, then the tap that launched Milo is read
  (`getLastNotificationResponse`); a tap waits until the navigation is mounted and opens once —
  however many times, and ways, it is reported — then the launch response is cleared. Signed out
  or before the challenge, it is dropped. The daily reminder's taps stay `ReminderSync`'s.
- **Opening a tab from anywhere** (`lib/open-tab.ts`, the reminder's tap too): with a screen open
  above the tabs (a quest, Settings, a modal) `router.dismissTo` returns to the tabs, onto that
  tab; already in the tabs, the tab is switched with `router.navigate`. `dismissTo` alone does
  nothing there: it sends `POP_TO`, which the JS tab navigator does not handle (only native tabs
  turn it into a tab switch) — the cause of taps that opened nothing on the first device test.
- **While Milo is open** team news shows as usual and the team is fetched again; a daily reminder
  stays quiet (as before).
- **Kept in the Keychain** (`stores/push-store.ts`): which accounts turned it on, the current
  registration and the tokens still to forget — a push token lets its holder notify the phone.

## Security and privacy

- **Tokens are never logged**, anywhere: log lines name devices by id; Expo's own error texts
  (which quote tokens) are never logged — only their codes — and anything else is masked
  (`ExponentPushToken[…a1b2]`). Request bodies are never logged, and the redaction list covers
  `token` as a second line of defence. `test/push-delivery.test.ts` checks it.
- **The payload** is `{ kind, teamId, dayNumber? }` — nothing more. The words name a teammate
  who did something good, as the team already sees them; never an email, an answer, an invite
  code or anything else of anyone's.
- **Secrets**: `EXPO_ACCESS_TOKEN` (optional, for Enhanced Push Security) lives only in the
  server's environment, never in the app or an `EXPO_PUBLIC_*` variable. `google-services.json`
  is not committed (see below). The FCM service-account key is never in the repository — the
  owner uploads it to EAS credentials themselves.
- Tests never send a push: the server's tests use a fake Expo (without one, the transport refuses
  to send), the app's tests a fake push system and server.

## Configuration

**App** (`app.json`, `app.config.ts`, `eas.json`):

- `android.package`: `com.jovid.milo` (the Firebase app's package).
- `expo-notifications` plugin: `color` `#2F6B46` (brand forest), `defaultChannel` `team-updates`.
  No custom small icon yet (see limitations).
- `app.config.ts` sets `android.googleServicesFile`: `$GOOGLE_SERVICES_JSON` (an EAS file
  variable) on EAS Build, `./google-services.json` (git-ignored) on this machine.
- EAS project `@frankfrudo/milo`, `extra.eas.projectId` `99ac1d65-8359-436a-a8a7-342b76710337`.
- `eas.json`: `development` (dev client, internal APK), `preview` (internal APK), `production`
  (app bundle, version code managed by EAS). Each profile uses the EAS environment of its name.
- `expo-dev-client`: `npx expo start` now serves development builds; **`npx expo start --go`**
  for Expo Go (which cannot receive team notifications on Android anyway).

**Firebase**: project `milo-9a4fa`, Android app `com.jovid.milo`, Cloud Messaging API (V1) on.
`google-services.json` is ignored by git (`.gitignore`), along with any service-account file name.

**EAS** (done by the owner, once): the file variable `GOOGLE_SERVICES_JSON` in every environment,
and the FCM V1 service-account key under _Credentials → Android → com.jovid.milo → FCM V1_.

**API** (`server/.env`):

| Variable              | Default | Meaning                                                                      |
| --------------------- | ------- | ---------------------------------------------------------------------------- |
| `PUSH_ENABLED`        | `true`  | Team news is queued and sent. `false` turns it all off.                      |
| `PUSH_WORKER_ENABLED` | `true`  | This process sends (run it in one process, or several — they never collide). |
| `EXPO_ACCESS_TOKEN`   | empty   | Needed only with Enhanced Push Security on in the Expo project.              |

Database: `push_devices`, `push_jobs`, `push_tickets` (migration `…_push_notifications`).

## Tests

- **Server** (`server/test/push-*.test.ts`): registration and its idempotence, refusals (no or
  revoked session, not an Expo token, unknown fields), token rotation, several devices, the
  ten-device cap, turning off, logout, a replayed refresh token, forgetting a token signed out,
  the account switch (the token moves; the previous account gets nothing), two registrations at
  once; who hears each event, one per person per action, supersession, a repeated or retried sync
  (no second news), the team day exactly once (two and three members finishing at once), the
  milestones 7/14/30/50/90 and a non-milestone, the switch off, signed out, a day finished late,
  `PUSH_ENABLED=false`; batching (whole jobs, ≤ 100), retries on 429/5xx/no answer with backoff
  and `Retry-After`, giving up, a refused request, the lease, `DeviceNotRegistered` from a ticket
  and from a receipt, a receipt never ready, two workers never sending a job twice, the worker
  loop, pruning, the HTTP transport, and no token in the logs.
- **App** (`src/features/push/__tests__`): the permission (asked only from the switch; granted;
  refused; blocked; offline), the token registered, rotated and confirmed per launch, turning off
  (offline too), signing out (offline, through a restart), the account switch (the next account
  never gets the previous one's news; forgetting never undoes its registration), taps (Friends,
  Today, once, cold start, a tap before the navigation is ready, duplicates, malformed data,
  signed out, the reminder's left alone), team news in the foreground, the Android channel, iOS
  and Expo Go unsupported, the daily reminder still local and unaffected. `lib/__tests__/open-tab`
  runs Expo Router's own routers: `dismissTo` inside the tabs is not handled, and `openTab`
  reaches the tab from every tab and from screens above the tabs.

## Real-device QA (Android, development build, 2026-10-01)

On a real Android phone — a development build from EAS, Metro and the Milo API on a Mac on the
same network:

- **Delivery**: team notifications arrive through Expo → FCM V1; Expo's receipts came back with no
  errors.
- **Taps**: with Milo open and in the background, team news opens Friends and "your turn" opens
  Today. (The first device test found taps that opened nothing: they were routed with
  `dismissTo`, which the JS tab navigator does not handle — fixed in `lib/open-tab.ts`.)
- **Team notifications off**: the registration is deleted, no news is queued for the account, and
  nothing arrives. **On again**: the device registers again and pushes arrive.
- **Logout**: the server ends the session with its registration and the phone forgets its token;
  news for the signed-out account (a teammate joining, a direct test push) is not queued or is
  cancelled (`noDevice`). Nothing arrives.
- **Account switch**: the same device token moves to the new account alone; news for the previous
  account never reaches the phone.
- **Duplicates**: "team day complete" arrives once; the same sync again (answered `duplicate`) and
  the day played again with new ids send nothing more.
- **Daily Reminder**: in airplane mode it is delivered, and its tap opens Today — no server, no
  network.

**Not conclusively verified: a true cold start** — tapping a notification after a phone reboot,
with Milo not running. In a development build the app's JavaScript comes from Metro on the
developer's Mac, and the phone itself provided the Mac's network (a hotspot): during the test the
Mac's address changed, the development client could not reach Metro and stayed on a white screen
before any of Milo's code ran. The cold-start path itself — the launch response read at start, a
tap waiting for the navigation, opening once — is covered by unit tests; it is to be confirmed on a
preview or production build, where the JavaScript is inside the app.

## Known limitations

- **Cold start not confirmed on a device**: see Real-device QA above.

- **Notification icon**: none of Milo's own yet. The mascot is a 3D render; a flat white
  silhouette of it is not recognizable at 24 dp, so none was made from it. Until a proper asset
  exists (96×96 PNG, white on transparent, in `assets-native/`, set as the `expo-notifications`
  plugin's `icon`), Android draws the app icon's silhouette, tinted green.
- **iOS**: no push until an Apple Developer account and APNs key exist; the switch is hidden there.
- **Accepted is not delivered**: a ticket says Expo took the message; receipts say FCM did. Neither
  proves the phone showed it (Doze, a force-stopped app, notifications muted by the user).
- **At least once**: see the worker — a crash in a narrow window can send a job twice.
- **Time zones**: news about "today" follows the finisher's calendar; friends far apart see the
  team day close at different hours (as the Friends tab does).
- **Per device**: the switch is per account on each phone; there is no account-wide setting.
