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
