import { Check, Lightbulb } from 'lucide-react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText, Button } from '@/components/ui';
import { colors, durations, radius, spacing } from '@/theme';

export type AnswerFeedbackProps = {
  correct: boolean;
  title: string;
  detail: string;
  onContinue: () => void;
};

/**
 * What the answer meant, and the way forward. A miss is framed as a hint
 * ("Not quite" + the right answer) — never as a failure — and Continue is
 * always there, so nobody gets stuck.
 */
export function AnswerFeedback({ correct, title, detail, onContinue }: AnswerFeedbackProps) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title}. ${detail}`);
  }, [title, detail]);

  const Icon = correct ? Check : Lightbulb;

  return (
    <Animated.View
      entering={FadeInUp.duration(durations.normal)}
      style={[styles.panel, correct ? styles.panelCorrect : styles.panelHint]}>
      <View style={styles.message}>
        <View style={[styles.icon, correct ? styles.iconCorrect : styles.iconHint]}>
          <Icon
            size={16}
            strokeWidth={correct ? 3 : 2.5}
            color={correct ? colors.text.inverse : colors.text.wood}
          />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" color={correct ? 'brand' : 'wood'}>
            {title}
          </AppText>
          <AppText variant="body" color="secondary">
            {detail}
          </AppText>
        </View>
      </View>
      <Button label="Continue" onPress={onContinue} fullWidth size="md" testID="quest-continue" />
    </Animated.View>
  );
}

const ICON = 28;

const styles = StyleSheet.create({
  panel: { borderRadius: radius.xl, padding: spacing[4], gap: spacing[4] },
  panelCorrect: { backgroundColor: colors.feedback.successSoft },
  panelHint: { backgroundColor: colors.surface.warm },
  message: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCorrect: { backgroundColor: colors.feedback.success },
  iconHint: { backgroundColor: colors.wood.light },
  text: { flex: 1, gap: 2 },
});
