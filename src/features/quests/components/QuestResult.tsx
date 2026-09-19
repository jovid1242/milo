import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText, Button, StatsRow, type Stat } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { useCountUp } from '@/hooks/use-count-up';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import type { RunResult } from '../hooks/use-quest-flow';
import { PerfectCelebration } from './PerfectCelebration';
import { QuestStage } from './QuestStage';

export type QuestResultProps = {
  /** "Vocabulary", "Grammar" — the title reads "Grammar complete". */
  questLabel: string;
  /** What the user takes away, e.g. "One new rule for the journey." */
  takeaway: string;
  result: RunResult;
  extraStats?: readonly Stat[];
  saveFailed: boolean;
  onRetrySave: () => void;
  /** Where the result leads; "Continue journey" by default. */
  continueLabel?: string;
  /** The next step is being saved: the button waits (and cannot be tapped twice). */
  continueBusy?: boolean;
  onContinue: () => void;
  /** Rays and the "Perfect run!" title for a perfect result (default on). */
  celebratePerfect?: boolean;
  /** A keepsake below the numbers: the new words, the rule learned. */
  children?: ReactNode;
};

function subtitleFor(result: RunResult, takeaway: string): string {
  if (!result.firstCompletion) return 'Practice done. The XP was earned the first time.';
  if (result.isPerfect) return 'Every answer right.';
  return takeaway;
}

/** The reward moment every quest ends with. */
export function QuestResult({
  questLabel,
  takeaway,
  result,
  extraStats = [],
  saveFailed,
  onRetrySave,
  continueLabel = 'Continue journey',
  continueBusy = false,
  onContinue,
  celebratePerfect = true,
  children,
}: QuestResultProps) {
  const perfect = result.isPerfect && celebratePerfect;
  const { width } = useWindowDimensions();
  const xp = result.xpEarned;
  const shownXp = useCountUp(
    xp ?? 0,
    xp !== null && xp > 0 ? { key: 'result', from: 0, to: xp } : null,
    { delayMs: 400 },
  );

  return (
    <QuestStage
      centered
      footer={
        saveFailed ? (
          <>
            <AppText variant="caption" color="danger" align="center">
              Your result could not be saved yet.
            </AppText>
            <Button label="Try again" onPress={onRetrySave} fullWidth />
          </>
        ) : (
          <Button
            label={continueLabel}
            onPress={onContinue}
            fullWidth
            disabled={xp === null || continueBusy}
            loading={continueBusy}
            testID="quest-continue-journey"
          />
        )
      }>
      <PerfectCelebration
        mascot={mascots.correct}
        width={clamp(Math.round(width * 0.5), 170, 220)}
        perfect={perfect}
      />

      <Animated.View
        entering={FadeInUp.duration(durations.normal).delay(120)}
        style={styles.titles}>
        <AppText variant="display" align="center" accessibilityRole="header">
          {perfect ? 'Perfect run!' : `${questLabel} complete`}
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          {subtitleFor(result, takeaway)}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(240)} style={styles.stats}>
        <StatsRow
          stats={[
            { label: 'correct', value: `${result.correctCount}/${result.total}` },
            { label: 'XP', value: xp === null ? '…' : xp === 0 ? '0' : `+${shownXp}` },
            ...extraStats,
          ]}
        />
        {result.perfectBonus > 0 ? (
          <AppText variant="caption" color="reward" align="center">
            {`Includes +${result.perfectBonus} XP for a perfect run`}
          </AppText>
        ) : null}
      </Animated.View>

      {children ? (
        <Animated.View entering={FadeIn.duration(durations.normal).delay(420)}>
          {children}
        </Animated.View>
      ) : null}
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  titles: { gap: spacing[2] },
  stats: { gap: spacing[2] },
});
