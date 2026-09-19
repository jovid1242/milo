import { useLocalSearchParams } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useQuest } from '@/features/challenge/queries';
import { ExamScreen } from '@/features/exams/ExamScreen';
import { GrammarQuestScreen } from '@/features/grammar/GrammarQuestScreen';
import { ReadingQuestScreen } from '@/features/reading/ReadingQuestScreen';
import { ReviewQuestScreen } from '@/features/review/ReviewQuestScreen';
import { VocabularyQuestScreen } from '@/features/vocabulary/VocabularyQuestScreen';
import type { QuestType } from '@/schemas';

import { QuestPlaceholderScreen } from './QuestPlaceholderScreen';

/** Quest types with real gameplay; the rest keep the placeholder until their stage. */
const GAMEPLAY: Partial<Record<QuestType, (props: { questId: string }) => React.ReactNode>> = {
  vocabulary: VocabularyQuestScreen,
  grammar: GrammarQuestScreen,
  reading: ReadingQuestScreen,
  review: ReviewQuestScreen,
  weeklyExam: ExamScreen,
  finalBattle: ExamScreen,
};

/**
 * Every quest opens here: one full-screen frame (no tab bar), and inside it
 * the gameplay of the quest's type.
 */
export function QuestScreen() {
  const { questId } = useLocalSearchParams<{ questId: string }>();
  const quest = useQuest(questId);
  const Gameplay = quest.data ? GAMEPLAY[quest.data.type] : undefined;

  if (!quest.isPending && !Gameplay) return <QuestPlaceholderScreen />;

  return (
    <Screen fullScreenModal edges={['top', 'bottom']} background="warm" testID="quest-screen">
      {quest.data && Gameplay ? <Gameplay questId={quest.data.id} /> : <LoadingState />}
    </Screen>
  );
}
