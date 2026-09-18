import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, IconButton, LoadingState, Screen } from '@/components/ui';
import { useQuest } from '@/features/challenge/queries';
import { useCompleteQuest, useStartQuest } from '@/features/progress/queries';
import type { QuestType } from '@/schemas';
import { spacing } from '@/theme';

import { QuestIcon } from './components/QuestIcon';

const TYPE_LABELS: Record<QuestType, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Reading',
  review: 'Review',
  weeklyExam: 'Weekly exam',
  finalBattle: 'Final battle',
};

/**
 * Temporary destination for Home's quest CTA: proves the navigation flow until
 * the real quest screens arrive. In development it can finish the quest, so
 * Home's completion moments can be tried end to end.
 */
export function QuestPlaceholderScreen() {
  const { questId } = useLocalSearchParams<{ questId: string }>();
  const router = useRouter();
  const quest = useQuest(questId);
  const complete = useCompleteQuest();
  const { mutate: start } = useStartQuest();

  // Opening a quest starts it: Home shows it as in progress from now on.
  useEffect(() => {
    if (questId) start(questId);
  }, [questId, start]);

  return (
    <Screen edges={['top', 'bottom']}>
      <IconButton
        icon={X}
        accessibilityLabel="Close"
        onPress={() => router.back()}
        style={styles.back}
      />

      {quest.isPending ? (
        <LoadingState />
      ) : !quest.data ? (
        <ErrorState title="Quest not found" message="This quest is not on the map." />
      ) : (
        <View style={styles.body}>
          <QuestIcon type={quest.data.type} size={88} />
          <View style={styles.text}>
            <AppText variant="overline" color="wood" align="center">
              {`${TYPE_LABELS[quest.data.type]} · Day ${quest.data.day}`}
            </AppText>
            <AppText variant="title1" align="center">
              {quest.data.title}
            </AppText>
            <AppText variant="body" color="secondary" align="center">
              {`${quest.data.summary} · ${quest.data.estimatedMinutes} min · +${quest.data.xpReward} XP`}
            </AppText>
          </View>
          <AppText variant="caption" color="tertiary" align="center">
            The quest itself arrives in the next stage.
          </AppText>
        </View>
      )}

      <View style={styles.actions}>
        {__DEV__ && quest.data ? (
          <Button
            label="Complete quest (dev)"
            fullWidth
            loading={complete.isPending}
            onPress={() =>
              complete.mutate(
                { questId: quest.data?.id ?? '', correctCount: 4, totalCount: 5, source: 'dev' },
                { onSuccess: () => router.back() },
              )
            }
          />
        ) : null}
        <Button label="Back to today" variant="secondary" fullWidth onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -spacing[3], marginTop: spacing[2] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5] },
  text: { gap: spacing[2], alignItems: 'center' },
  actions: { gap: spacing[3], paddingBottom: spacing[6] },
});
