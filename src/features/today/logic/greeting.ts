import type { MascotKey } from '@/constants/assets';

import type { TodayJourney } from './today-journey';

/** What Milo says on Home: a pose and two short lines, reacting to real progress. */
export type Greeting = {
  mascot: MascotKey;
  title: string;
  subtitle: string;
};

/** "about 20 min": rounded to 5 so the estimate does not pretend to be exact. */
function roughMinutes(minutes: number): string {
  return `about ${Math.max(5, Math.round(minutes / 5) * 5)} min`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function getGreeting(journey: TodayJourney): Greeting {
  const { day, dayKind, steps, completedCount, current } = journey;

  if (journey.isComplete) {
    return dayKind === 'summit'
      ? {
          mascot: 'correct',
          title: 'We reached the summit!',
          subtitle: `+${journey.xpEarnedToday} XP · 90 days, done`,
        }
      : {
          mascot: 'correct',
          title: `Day ${day} complete!`,
          subtitle: `+${journey.xpEarnedToday} XP earned today`,
        };
  }

  if (completedCount === 0) {
    if (dayKind === 'summit') {
      return {
        mascot: 'walking',
        title: 'The summit is close.',
        subtitle: 'One last climb, together.',
      };
    }
    if (day === 1) {
      return { mascot: 'idle', title: 'Ready for Day 1?', subtitle: 'Our journey starts here.' };
    }
    if (dayKind === 'weeklyExam') {
      return { mascot: 'learning', title: 'Exam day!', subtitle: 'Warm up first, then the exam.' };
    }
    if (journey.streak === 0) {
      return { mascot: 'idle', title: 'Fresh start today.', subtitle: "Let's light a new streak." };
    }
    return {
      mascot: 'idle',
      title: `Ready for Day ${day}?`,
      subtitle: `${plural(steps.length, 'quest')} · ${roughMinutes(journey.minutesLeft)}`,
    };
  }

  const left = steps.length - completedCount;
  if (left === 1 && current) {
    return {
      mascot: 'walking',
      title: 'One more step!',
      subtitle: `${current.quest.title}, then camp.`,
    };
  }
  return {
    mascot: 'walking',
    title: "Let's keep moving.",
    subtitle: `${plural(left, 'quest')} to camp`,
  };
}
