import { useEffect, useEffectEvent } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button } from '@/components/ui';
import { effects } from '@/constants/assets';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { ExamScore } from '@/schemas';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

/** Long enough to read the score; short enough that the summit still feels like one moment. */
const RESOLVE_MS = 2600;

export type FinalPassedProps = {
  result: ExamScore;
  onContinue: () => void;
};

/**
 * The Final Battle's result resolving: passed (or perfect), the score — and
 * then the summit. No sound of its own: the victory's music is the one moment.
 */
export function FinalPassed({ result, onContinue }: FinalPassedProps) {
  const { width } = useWindowDimensions();
  const crest = clamp(Math.round(width * 0.32), 112, 140);
  const percent = Math.round(result.score * 100);

  // Leads on by itself; the button is there for anyone who wants to go now.
  const advance = useEffectEvent(onContinue);
  useEffect(() => {
    const timer = setTimeout(() => advance(), RESOLVE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QuestStage
      centered
      footer={
        <Button
          label="Reach the summit"
          onPress={onContinue}
          fullWidth
          testID="final-reach-summit"
        />
      }>
      <View style={[styles.crest, { height: crest * 1.6 }]}>
        {result.isPerfect ? (
          <Animated.View entering={FadeIn.duration(durations.slow)} style={styles.rays}>
            <AssetImage asset={effects.perfectRays} width={Math.round(crest * 2.2)} />
          </Animated.View>
        ) : null}
        <Animated.View entering={ZoomIn.duration(durations.slow)}>
          <QuestIcon type="finalBattle" size={crest} />
        </Animated.View>
      </View>
      <Animated.View
        entering={FadeInUp.duration(durations.normal).delay(200)}
        style={styles.text}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`Final Battle ${result.isPerfect ? 'passed, perfect' : 'passed'}. ${result.correctCount} of ${result.totalCount}, ${percent} percent.`}>
        <AppText variant="overline" color="reward" align="center">
          {result.isPerfect ? 'Final Battle · Perfect' : 'Final Battle'}
        </AppText>
        <AppText variant="displayLarge" align="center">
          Passed
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center" testID="final-score">
          {`${result.correctCount} / ${result.totalCount} · ${percent}%`}
        </AppText>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(700)}>
        <AppText variant="body" color="secondary" align="center">
          The summit is right above you.
        </AppText>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  crest: { alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  text: { gap: spacing[2] },
});
