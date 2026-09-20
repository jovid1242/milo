import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText, Card } from '@/components/ui';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import type { QuestType } from '@/schemas';
import { colors, durations, radius, spacing } from '@/theme';

const KINDS: readonly { type: QuestType; label: string; hint: string }[] = [
  { type: 'vocabulary', label: 'Vocabulary', hint: 'Six new words' },
  { type: 'grammar', label: 'Grammar', hint: 'How it fits together' },
  { type: 'reading', label: 'Reading', hint: 'Short real texts' },
  { type: 'review', label: 'Review', hint: 'What you already met' },
];

/** Step three: what a day actually asks of you. */
export function DailyQuests() {
  return (
    <View style={styles.step} testID="onboarding-day">
      <Animated.View entering={FadeInUp.duration(durations.normal)} style={styles.text}>
        <AppText variant="title2" align="center" accessibilityRole="header">
          About fifteen minutes a day.
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          Three or four small quests, then the day is done and your streak grows.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(140)} style={styles.grid}>
        {KINDS.map((kind) => (
          <Card key={kind.type} tone="warm" padding={4} style={styles.card}>
            <View
              accessible
              accessibilityLabel={`${kind.label}: ${kind.hint}`}
              style={styles.cardBody}>
              <QuestIcon type={kind.type} size={40} />
              <AppText variant="bodyMedium">{kind.label}</AppText>
              <AppText variant="caption" color="secondary">
                {kind.hint}
              </AppText>
            </View>
          </Card>
        ))}
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(260)}>
        <View style={styles.note} accessible>
          <QuestIcon type="weeklyExam" size={32} />
          <AppText variant="caption" color="secondary" style={styles.noteText}>
            Every seventh day is a checkpoint exam — and Day 90 is the Final Battle.
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  text: { gap: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: { flexGrow: 1, flexBasis: '46%' },
  cardBody: { gap: spacing[1] },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface.brandSoft,
  },
  noteText: { flex: 1 },
});
