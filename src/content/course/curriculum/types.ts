import type { FinalBlueprint, GrammarStage, ReadingGenre, ReadingQuestionKind } from '@/schemas';

import type { GrammarTopicId } from './grammar-topics';
import type { ThemeFamilyId } from './themes';

/**
 * How the curriculum is authored: one draft per day, only what a person
 * decides. The rest — text length and question count from the band, the
 * review's days and mix, what a weekly exam covers — is worked out from the
 * course plan when the course is built (`attachCurriculum`), so it is never
 * written twice.
 */

type DayTheme = { family: ThemeFamilyId; title: string };

type VocabularyDraft = {
  /** The semantic field of the day's new words. */
  focus: string;
  /** Anchor words, not the list: the content picks the rest, never repeating a word. */
  examples: string[];
};

export type RegularDayDraft = {
  day: number;
  kind: 'regular';
  theme: DayTheme;
  vocabulary: VocabularyDraft;
  grammar: {
    topic: GrammarTopicId;
    stage: GrammarStage;
    /** Topics contrasted or recycled alongside. */
    related?: GrammarTopicId[];
    objective: string;
  };
  reading: {
    genre: ReadingGenre;
    topic: string;
    /** Defaults to the band's skills. */
    skills?: ReadingQuestionKind[];
  };
  /** NEEDS_CONTENT_REVISION: why the written day no longer fits. */
  revision?: string;
};

export type CheckpointDayDraft = {
  day: number;
  kind: 'weeklyExam';
  theme: DayTheme;
  vocabulary: VocabularyDraft;
  /** What the week's exam checks, in one sentence. */
  objective: string;
  mustRetain: string[];
  revision?: string;
};

export type SummitDayDraft = {
  day: number;
  kind: 'summit';
  theme: DayTheme;
  final: Omit<FinalBlueprint, 'grammarStrands'> & {
    grammarStrands: { title: string; topics: GrammarTopicId[] }[];
  };
  revision?: string;
};

export type DayDraft = RegularDayDraft | CheckpointDayDraft | SummitDayDraft;
