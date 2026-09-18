import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import type { Quest } from '@/schemas';
import { colors, radius, spacing } from '@/theme';

export type QuestRowProps = {
  quest: Quest;
  completed: boolean;
};

/**
 * Presentational for now: quest screens arrive with the learning flows, and the
 * row becomes a link then.
 */
export function QuestRow({ quest, completed }: QuestRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}. ${quest.summary}. ${
        completed ? 'Completed' : `${quest.xpReward} XP, about ${quest.estimatedMinutes} minutes`
      }`}
      style={styles.row}>
      <QuestIcon type={quest.type} size={44} />
      <View style={styles.text}>
        <AppText variant="title3" color={completed ? 'tertiary' : 'primary'}>
          {quest.title}
        </AppText>
        <AppText variant="caption" color="secondary">
          {quest.summary} · {quest.estimatedMinutes} min
        </AppText>
      </View>
      {completed ? (
        <View style={styles.check}>
          <Check size={16} color={colors.text.inverse} strokeWidth={3} />
        </View>
      ) : (
        <AppText variant="label" color="reward">
          +{quest.xpReward} XP
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 64,
  },
  text: { flex: 1, gap: spacing[1] },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
