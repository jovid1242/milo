import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button } from '@/components/ui';
import type { ImageAsset } from '@/constants/assets';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { QuestStage } from './QuestStage';

export type QuestIntroProps = {
  mascot: ImageAsset;
  /** e.g. "Day 89 · Grammar" */
  overline: string;
  title: ReactNode;
  subtitle: string;
  /** e.g. "about 5 min", "3 min read" */
  duration: string;
  /** Small quiet tags next to the duration, e.g. the level "B1". */
  tags?: readonly string[];
  xpReward: number;
  /** Replaying a finished quest: practice only, no XP to promise. */
  replay: boolean;
  ctaLabel: string;
  ctaHint?: string;
  onStart: () => void;
};

/** A short hello before a quest: what it is, how long, what it pays. */
export function QuestIntro({
  mascot,
  overline,
  title,
  subtitle,
  duration,
  tags = [],
  xpReward,
  replay,
  ctaLabel,
  ctaHint,
  onStart,
}: QuestIntroProps) {
  const { width } = useWindowDimensions();

  return (
    <QuestStage
      centered
      footer={
        <Button
          label={ctaLabel}
          onPress={onStart}
          fullWidth
          sound="tapSoft"
          accessibilityHint={ctaHint}
          testID="quest-start"
        />
      }>
      <Animated.View entering={FadeInDown.duration(durations.slow)} style={styles.milo}>
        <AssetImage asset={mascot} width={clamp(Math.round(width * 0.62), 200, 270)} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(120)} style={styles.text}>
        <AppText variant="overline" color="wood" align="center">
          {overline}
        </AppText>
        {typeof title === 'string' ? (
          <AppText variant="display" align="center" accessibilityRole="header">
            {title}
          </AppText>
        ) : (
          title
        )}
        <AppText variant="bodyLarge" color="secondary" align="center">
          {subtitle}
        </AppText>
        <View style={styles.meta}>
          {tags.map((tag) => (
            <Badge key={tag} label={tag} tone="wood" />
          ))}
          <AppText variant="label" color="secondary">
            {duration}
          </AppText>
          {replay ? (
            <Badge label="Practice · no XP" tone="neutral" />
          ) : (
            <Badge label={`+${xpReward} XP`} tone="reward" />
          )}
        </View>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  milo: { alignItems: 'center' },
  text: { gap: spacing[2], alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
});
