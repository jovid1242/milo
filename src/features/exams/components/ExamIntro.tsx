import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { Exam, ExamAttempt } from '@/schemas';
import { colors, durations, radius, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { passMark } from '../logic/exam';

export type ExamIntroProps = {
  exam: Exam;
  /** An attempt left open: the intro offers to resume it. */
  open: ExamAttempt | null;
  /** The pass reward was paid on an earlier try. */
  rewardPaid: boolean;
  busy: boolean;
  onStart: () => void;
};

/**
 * A calm checkpoint before an exam: what it covers, how it works, what it
 * pays. The weekly exam brings Milo with his books; the Final Battle its
 * crest — the summit's own intro came just before.
 */
export function ExamIntro({ exam, open, rewardPaid, busy, onStart }: ExamIntroProps) {
  const { width } = useWindowDimensions();
  const total = exam.questions.length;
  const resuming = open !== null;
  const final = exam.type === 'finalBattle';
  const startLabel = final
    ? resuming
      ? 'Resume the Final Battle'
      : 'Start the Final Battle'
    : resuming
      ? 'Resume exam'
      : 'Start exam';
  const rules = [
    'Answers are checked when you finish.',
    'Go back and change any answer until then.',
    `Pass with ${passMark(exam)} of ${total} right (${Math.round(exam.passingScore * 100)}%).`,
  ];

  return (
    <QuestStage
      centered
      footer={
        <Button
          label={startLabel}
          onPress={onStart}
          fullWidth
          loading={busy}
          disabled={busy}
          // Starting has its own sound (played on a real start only).
          sound={resuming ? 'tapSoft' : null}
          accessibilityHint={
            resuming
              ? `Back to question ${(open?.currentIndex ?? 0) + 1}`
              : 'Starts the first question'
          }
          testID="exam-start"
        />
      }>
      <Animated.View entering={FadeInDown.duration(durations.slow)} style={styles.milo}>
        {final ? (
          <QuestIcon type="finalBattle" size={clamp(Math.round(width * 0.36), 120, 156)} />
        ) : (
          <AssetImage asset={mascots.learning} width={clamp(Math.round(width * 0.52), 180, 230)} />
        )}
      </Animated.View>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(120)} style={styles.text}>
        <View style={styles.kicker}>
          {final ? null : <QuestIcon type="weeklyExam" size={32} />}
          <AppText variant="overline" color="wood">
            {final ? `Day ${exam.day} · Summit` : 'Weekly exam'}
          </AppText>
        </View>
        <AppText variant="display" align="center" accessibilityRole="header">
          {exam.type === 'finalBattle' ? 'Final Battle' : `Week ${exam.week}`}
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          {resuming
            ? `You stopped at question ${(open?.currentIndex ?? 0) + 1}. ${open?.answers.length ?? 0} of ${total} answered.`
            : final
              ? 'Everything you’ve learned, one last time.'
              : "Test what you've learned this week."}
        </AppText>
        <View style={styles.meta}>
          <Badge label={`${total} questions`} tone="wood" />
          <AppText variant="label" color="secondary">
            {`~${exam.estimatedMinutes} min`}
          </AppText>
          {rewardPaid ? (
            <Badge label="Reward earned" tone="neutral" />
          ) : exam.xpReward > 0 ? (
            <Badge label={`+${exam.xpReward} XP`} tone="reward" />
          ) : null}
        </View>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(240)} style={styles.rules}>
        {rules.map((rule) => (
          <View key={rule} style={styles.rule}>
            <View style={styles.bullet} />
            <AppText variant="body" color="secondary" style={styles.ruleText}>
              {rule}
            </AppText>
          </View>
        ))}
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  milo: { alignItems: 'center' },
  text: { gap: spacing[2], alignItems: 'center' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  rules: {
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.warm,
  },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: colors.wood.base,
  },
  ruleText: { flex: 1 },
});
