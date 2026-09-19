/**
 * Quests whose completion was already celebrated on their own result screen in
 * this app session. Home still animates them (check, trail, XP) but skips the
 * "quest complete" sound, so the user never hears the same moment twice.
 */
const celebrated = new Set<string>();

export function markQuestCelebrated(questId: string): void {
  celebrated.add(questId);
}

export function wasQuestCelebrated(questId: string): boolean {
  return celebrated.has(questId);
}

/**
 * Finished days celebrated in this app session — by the Day Complete screen or,
 * as a fallback, on Home. Storage keeps the same fact (`celebratedAt`) across
 * launches; this covers the moments before it is saved. Keyed by the record, not
 * the day number: a day completed again after a reset is a new moment.
 */
type DayRecordKey = { day: number; completedAt: string };

const celebratedDays = new Set<string>();
const keyOf = (record: DayRecordKey) => `${record.day}@${record.completedAt}`;

export function rememberDayCelebrated(record: DayRecordKey): void {
  celebratedDays.add(keyOf(record));
}

export function wasDayCelebrated(record: DayRecordKey): boolean {
  return celebratedDays.has(keyOf(record));
}
