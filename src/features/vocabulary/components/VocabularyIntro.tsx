import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, Button } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { Quest } from '@/schemas';
import { durations, spacing } from '@/theme';
import { clamp } from '@/utils/number';

export type VocabularyIntroProps = {
  quest: Quest;
  wordCount: number;
  /** Replaying a finished quest: practice only, no XP to promise. */
  replay: boolean;
  onStart: () => void;
};

/** A short hello before the words: how many, how long, what it pays. */
export function VocabularyIntro({ quest, wordCount, replay, onStart }: VocabularyIntroProps) {
  const { width } = useWindowDimensions();

  return (
    <QuestStage
      centered
      footer={
        <Button
          label="Start"
          onPress={onStart}
          fullWidth
          sound="tapSoft"
          accessibilityHint="Begins with the first new word"
          testID="vocabulary-start"
        />
      }>
      <Animated.View entering={FadeInDown.duration(durations.slow)} style={styles.milo}>
        <AssetImage asset={mascots.vocabulary} width={clamp(Math.round(width * 0.62), 200, 270)} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(durations.normal).delay(120)} style={styles.text}>
        <AppText variant="overline" color="wood" align="center">
          {`Day ${quest.day} · Vocabulary`}
        </AppText>
        <AppText variant="display" align="center" accessibilityRole="header">
          {`${wordCount} new words`}
        </AppText>
        <AppText variant="bodyLarge" color="secondary" align="center">
          Meet each word, then use it.
        </AppText>
        <View style={styles.meta}>
          <AppText variant="label" color="secondary">
            {`about ${quest.estimatedMinutes} min`}
          </AppText>
          {replay ? (
            <Badge label="Practice · no XP" tone="neutral" />
          ) : (
            <Badge label={`+${quest.xpReward} XP`} tone="reward" />
          )}
        </View>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  milo: { alignItems: 'center' },
  text: { gap: spacing[2], alignItems: 'center' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
});
