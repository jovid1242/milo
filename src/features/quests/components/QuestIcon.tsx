import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import { quests, type VectorAsset } from '@/constants/assets';
import type { QuestType } from '@/schemas';

import GrammarStandIn from '../assets/quest-grammar-standin.svg';

/**
 * quest-grammar.svg is still missing from the asset pack (ASSET_MANIFEST.md →
 * MISSING). Until it arrives, a stand-in drawn in the same style fills the gap:
 * same canvas, palette, strokes and sparkle as the other quest icons. Once the
 * real file is added, the regenerated registry wins automatically.
 */
const registry: Partial<Record<QuestType, VectorAsset>> = quests;

const ICONS: Record<QuestType, FC<SvgProps>> = {
  vocabulary: quests.vocabulary.Component,
  grammar: registry.grammar?.Component ?? GrammarStandIn,
  reading: quests.reading.Component,
  review: quests.review.Component,
  weeklyExam: quests.weeklyExam.Component,
  finalBattle: quests.finalBattle.Component,
};

export type QuestIconProps = {
  type: QuestType;
  size?: number;
};

export function QuestIcon({ type, size = 44 }: QuestIconProps) {
  const Icon = ICONS[type];
  return <Icon width={size} height={size} />;
}
