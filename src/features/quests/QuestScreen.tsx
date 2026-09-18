import { useLocalSearchParams } from 'expo-router';

import { LoadingState, Screen } from '@/components/ui';
import { useQuest } from '@/features/challenge/queries';
import { VocabularyQuestScreen } from '@/features/vocabulary/VocabularyQuestScreen';

import { QuestPlaceholderScreen } from './QuestPlaceholderScreen';

/**
 * Opens the gameplay that matches the quest type. Types without gameplay yet
 * keep the placeholder until their stage is built.
 */
export function QuestScreen() {
  const { questId } = useLocalSearchParams<{ questId: string }>();
  const quest = useQuest(questId);

  if (quest.isPending) {
    return (
      <Screen fullScreenModal background="warm">
        <LoadingState />
      </Screen>
    );
  }
  if (quest.data?.type === 'vocabulary') return <VocabularyQuestScreen questId={quest.data.id} />;
  return <QuestPlaceholderScreen />;
}
