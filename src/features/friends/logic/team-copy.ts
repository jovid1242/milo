import type { TeamActivity } from '@/schemas';

import type { MemberTodayStatus, MemberView, TeamView } from './team';

/**
 * Friendly, pressure-free words for the team. The team is named, never a
 * person: "One more to go", not "Waiting for Mia".
 */

export const STATUS_LABELS: Record<MemberTodayStatus, string> = {
  done: 'Done',
  almostThere: 'Almost there',
  inProgress: 'In progress',
  notStarted: 'Not started yet',
  unknown: 'Not shared',
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

/** "Day 89 · 3 of 4 quests" — progress only when it is shared. */
export function memberTodayLine(member: MemberView, view: TeamView): string {
  const day = `Day ${view.currentDay}`;
  if (member.status === 'done') return `${day} · ${view.questCount} of ${view.questCount} quests`;
  if (member.todayQuestsDone === null) return day;
  return `${day} · ${member.todayQuestsDone} of ${view.questCount} quests`;
}

export function memberName(member: Pick<MemberView, 'displayName' | 'isCurrentUser'>): string {
  return member.isCurrentUser ? 'You' : member.displayName;
}

/** The words for an activity event; the event itself stays structured data. */
export function activityText(
  event: TeamActivity,
  who: string,
  achievementTitle: (id: string) => string,
): string {
  switch (event.type) {
    case 'dayCompleted':
      return `${who} completed Day ${event.metadata.day}`;
    case 'streakMilestone':
      return `${who} reached a ${event.metadata.days}-day streak`;
    case 'achievementUnlocked':
      return `${who} unlocked ${achievementTitle(event.metadata.achievementId)}`;
    case 'memberJoined':
      return `${who} joined the team`;
  }
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
