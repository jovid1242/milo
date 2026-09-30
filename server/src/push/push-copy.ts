/**
 * What team notifications say: short, warm, never pushy — the words the
 * Friends tab uses. They name the teammate who did something good ("Ada
 * finished today"), never one who has not yet: a team is nudged, not a person
 * singled out. Names are what the team already shows; nothing else of anyone's
 * appears — no email, no answers, no code.
 */

export type PushCopy = { title: string; body: string };

const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

export function memberJoinedCopy(name: string): PushCopy {
  return {
    title: `${name} joined your team`,
    body: 'Climb the 90 days together — the team streak grows on the days everyone finishes.',
  };
}

export function memberCompletedDayCopy(name: string, done: number, total: number): PushCopy {
  const title = `${name} finished today`;
  if (total < 2) return { title, body: 'Your team is on the move.' };
  const line = done === total - 1 ? 'One more to go.' : 'Everyone’s moving.';
  return { title, body: `${done} of ${total} finished today. ${line}` };
}

/** To the one member still to finish: the team is waiting, kindly. */
export function yourTurnCopy(done: number, total: number, otherName: string | null): PushCopy {
  return {
    title: 'One more to go',
    body:
      total === 2 && otherName
        ? `${otherName} is done — your turn!`
        : `${done} of ${total} are done — your turn!`,
  };
}

export function teamDayCompleteCopy(streak: number): PushCopy {
  return {
    title: 'Team day complete',
    body: `Everyone finished today. Team streak: ${days(streak)}.`,
  };
}

export function streakMilestoneCopy(streak: number): PushCopy {
  return {
    title: `${streak}-day team streak!`,
    body: `Everyone finished ${streak} days in a row. Keep climbing together.`,
  };
}
