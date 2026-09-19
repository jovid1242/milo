import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button } from '@/components/ui';
import { mascots } from '@/constants/assets';
import type { QuestCompletion } from '@/schemas';
import { durations, spacing } from '@/theme';

import { QuestStage } from './QuestStage';

export type QuestCompletedProps = {
  completion: QuestCompletion;
  onPracticeAgain: () => void;
  onClose: () => void;
  /** The same keepsake as on the result: the words, the rule. */
  children?: ReactNode;
};

/** Reopening a finished quest: what was earned, and an optional XP-free replay. */
export function QuestCompleted({
  completion,
  onPracticeAgain,
  onClose,
  children,
}: QuestCompletedProps) {
  return (
    <QuestStage
      centered
      footer={
        <>
          <Button label="Back to journey" onPress={onClose} fullWidth />
          <Button label="Practice again" variant="ghost" onPress={onPracticeAgain} fullWidth />
        </>
      }>
      <Animated.View entering={FadeIn.duration(durations.normal)} style={styles.body}>
        <AssetImage asset={mascots.correct} width={180} />
        <View style={styles.text}>
          <AppText variant="display" align="center" accessibilityRole="header">
            Quest complete
          </AppText>
          <AppText variant="bodyLarge" color="secondary" align="center">
            {`${completion.correctCount} of ${completion.totalCount} correct · +${completion.xpEarned} XP earned`}
          </AppText>
        </View>
        {children}
        <AppText variant="caption" color="tertiary" align="center">
          Practicing again will not change your XP.
        </AppText>
      </Animated.View>
    </QuestStage>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing[6] },
  text: { gap: spacing[2] },
});
