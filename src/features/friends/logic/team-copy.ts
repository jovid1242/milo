import type { InvitePreview, InvitePreviewStatus } from '@/schemas';

import type { MemberTodayStatus, MemberView, TeamView } from './team';
import { inviteLink } from './invite-code';

/**
 * Friendly, pressure-free words for the team. The team is named, never a
 * person: "One more to go", not "Waiting for Mia".
 */

export const STATUS_LABELS: Record<MemberTodayStatus, string> = {
  done: 'Done',
  almostThere: 'Almost there',
  inProgress: 'In progress',
  notStarted: 'Not started yet',
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "2 of 3 finished today" and one encouraging line. */
export function todaySummary(view: TeamView): { title: string; line: string } {
  const total = view.members.length;
  if (view.isTeamDayComplete)
    return { title: 'Team day complete', line: 'Everyone finished today.' };
  const title = `${view.finishedToday} of ${total} finished today`;
  if (view.finishedToday === 0) return { title, line: 'A new day on the trail for everyone.' };
  if (view.finishedToday === total - 1) return { title, line: 'One more to go.' };
  return { title, line: "Everyone's moving." };
}

/** The team streak, told kindly — a broken streak is just a new start. */
export function teamStreakCopy(view: TeamView): { title: string; line: string } {
  if (view.teamStreak === 0) {
    return {
      title: 'Start your team streak',
      line: 'Finish a day together to light it.',
    };
  }
  const title = plural(view.teamStreak, 'day');
  if (view.isTeamDayComplete) return { title, line: 'Everyone finished today.' };
  return { title, line: 'Everyone finished yesterday. Keep the streak alive.' };
}

/** "Day 12 · 3 of 4 quests" — each member on their own day. */
export function memberTodayLine(member: MemberView): string {
  const day = `Day ${member.currentDay}`;
  if (member.questCount === 0) return day;
  const done = member.status === 'done' ? member.questCount : member.todayQuestsDone;
  return `${day} · ${done} of ${member.questCount} quests`;
}

export function memberName(member: Pick<MemberView, 'displayName' | 'isCurrentUser'>): string {
  return member.isCurrentUser ? 'You' : member.displayName;
}

/** "2/3 members". */
export const memberCount = (count: number, capacity: number) => `${count}/${capacity} members`;

/**
 * What the system share sheet sends: a short invitation, the link that opens
 * Milo on the invite, and the code for typing in by hand.
 */
export function inviteShareMessage(code: string): string {
  return [
    'Join my team on Milo — the 90-day English challenge for three friends.',
    `Open: ${inviteLink(code)}`,
    `Or enter the code ${code} in Milo → Friends → Join with a code.`,
  ].join('\n');
}

/** "Expires in 7 days" · "Expires in 1 day" — any part of a day counts as one. */
export function inviteExpiry(expiresAt: string, now: Date = new Date()): string {
  const left = Date.parse(expiresAt) - now.getTime();
  if (left <= 0) return 'Expired';
  return `Expires in ${plural(Math.ceil(left / (24 * 60 * 60_000)), 'day')}`;
}

/** The invite's page, for what the user can do with it. */
export function previewCopy(preview: InvitePreview): { title: string; line: string } {
  const lines: Record<InvitePreviewStatus, string> = {
    canJoin: `${memberCount(preview.memberCount, preview.capacity)}. Climb the 90 days together: a team streak grows on the days everyone finishes.`,
    full: `A Milo team has ${preview.capacity} people, and this one is complete. You can start a team of your own.`,
    alreadyMember: "You're in this team already.",
    inAnotherTeam: "You're in another team. To join this one, leave yours first.",
  };
  return { title: preview.teamName, line: lines[preview.status] };
}

/** "just now" · "25 min ago" · "3 h ago" · "yesterday" · "4 days ago" */
export function relativeTime(timestamp: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(timestamp)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
