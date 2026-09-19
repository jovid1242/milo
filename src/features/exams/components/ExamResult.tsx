import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button, StatsRow } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { PerfectCelebration } from '@/features/quests/components/PerfectCelebration';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { useCountUp } from '@/hooks/use-count-up';
import type { Exam, ExamAnswer, ExamScore } from '@/schemas';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { passMark, sectionScores } from '../logic/exam';
import { SECTION_LABELS } from './ExamQuestion';

export type ExamAction = { label: string; onPress: () => void; busy?: boolean };

/** How a result speaks of its exam: "Week 12 exam" or "Final Battle". */
export type ExamResultCopy = {
  name: string;
  passed: string;
  notPassed: string;
};

export type ExamResultProps = {
  exam: Exam;
  copy: ExamResultCopy;
  result: ExamScore;
  answers: readonly ExamAnswer[];
  /**
   * XP paid by this submission — counted up once. `0` with a pass means the
   * reward came on an earlier try.
   */
  xpEarned: number;
  /** Reopened later: the numbers rest (the moment played when it happened). */
  settled: boolean;
  primary: ExamAction;
  secondary: ExamAction | null;
};

const percent = (score: number) => `${Math.round(score * 100)}%`;

function rewardLine(result: ExamScore, xpEarned: number, settled: boolean) {
  if (!result.passed || xpEarned > 0) return null;
  return settled ? 'Reward earned' : 'Reward earned on an earlier try';
}

/**
 * The exam's result. Passing is a quiet celebration — Milo, the score, the
 * reward. Not passing yet is never a failure screen: the score, how far it is
 * to the pass line, and a way to look at the tricky parts.
 */
export function ExamResult({
  exam,
  copy,
  result,
  answers,
  xpEarned,
  settled,
  primary,
  secondary,
}: ExamResultProps) {
  const { width } = useWindowDimensions();
  const heroWidth = clamp(Math.round(width * 0.46), 160, 210);
  const shownXp = useCountUp(
    xpEarned,
    !settled && xpEarned > 0 ? { key: 'exam-result', from: 0, to: xpEarned } : null,
    { delayMs: 500 },
  );
  const sections = sectionScores(exam, answers).map((entry) => ({
    label: SECTION_LABELS[entry.section].toLowerCase(),
    value: `${entry.correct}/${entry.total}`,
  }));
  const reward = rewardLine(result, xpEarned, settled);
  const score = `${result.correctCount} / ${result.totalCount}`;

  return (
    <QuestStage
      centered
      footer={
        <>
          <Button
            label={primary.label}
            onPress={primary.onPress}
            fullWidth
            loading={primary.busy}
            disabled={primary.busy}
            testID="exam-result-primary"
          />
          {secondary ? (
            <Button
              label={secondary.label}
              onPress={secondary.onPress}
              fullWidth
              variant="ghost"
              loading={secondary.busy}
              disabled={secondary.busy}
              testID="exam-result-secondary"
            />
          ) : null}
        </>
      }>
      {result.passed ? (
        <PerfectCelebration mascot={mascots.correct} width={heroWidth} perfect={result.isPerfect} />
      ) : (
        <Animated.View entering={ZoomIn.duration(durations.slow)} style={styles.hero}>
          <AssetImage asset={mascots.thinking} width={heroWidth} />
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInUp.duration(durations.normal).delay(120)}
        style={styles.titles}
        accessible
        accessibilityRole="header"
        accessibilityLabel={
          result.passed
            ? `${result.isPerfect ? `${copy.name}, perfect` : copy.passed}. ${result.correctCount} of ${result.totalCount} right, ${percent(result.score)}.`
            : `${copy.notPassed} ${result.correctCount} of ${result.totalCount} right, ${percent(result.score)}. ${passMark(exam)} right answers pass.`
        }>
        <AppText variant="overline" color={result.passed ? 'reward' : 'wood'} align="center">
          {result.passed ? (result.isPerfect ? `${copy.name} · Perfect` : copy.passed) : copy.name}
        </AppText>
        {result.passed ? (
          <AppText variant="displayLarge" align="center" testID="exam-score">
            {score}
          </AppText>
        ) : (
          <AppText variant="display" align="center">
            {copy.notPassed}
          </AppText>
        )}
        <AppText variant="bodyLarge" color="secondary" align="center">
          {result.passed
            ? result.isPerfect
              ? `Every answer right · ${percent(result.score)}`
              : `${percent(result.score)} · ${passMark(exam)} needed to pass`
            : `${score} · ${percent(result.score)}. ${passMark(exam)} right answers pass — review the tricky parts and try again.`}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(260)} style={styles.stats}>
        {xpEarned > 0 ? (
          <Badge label={`+${settled ? xpEarned : shownXp} XP`} tone="reward" style={styles.xp} />
        ) : reward ? (
          <AppText variant="caption" color="secondary" align="center">
            {reward}
          </AppText>
        ) : null}
        <StatsRow stats={sections} />
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  titles: { gap: spacing[2] },
  stats: { gap: spacing[4] },
  xp: { alignSelf: 'center' },
});
