import { Check, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components/ui';
import { colors, radius, spacing, springs, type TextColor } from '@/theme';

/**
 * - `idle`: can be chosen
 * - `correct`: the user's pick, and right
 * - `wrong`: the user's pick, and not right
 * - `answer`: the right option, revealed after a wrong pick
 * - `dimmed`: the rest once the question is answered
 */
export type AnswerState = 'idle' | 'correct' | 'wrong' | 'answer' | 'dimmed';

export type AnswerOptionProps = {
  label: string;
  state: AnswerState;
  onPress: () => void;
  testID?: string;
};

const LOOK: Record<AnswerState, { background: string; border: string; text: TextColor }> = {
  idle: { background: colors.surface.base, border: colors.border.warm, text: 'primary' },
  correct: {
    background: colors.feedback.successSoft,
    border: colors.feedback.success,
    text: 'brand',
  },
  wrong: { background: colors.feedback.dangerSoft, border: colors.feedback.danger, text: 'danger' },
  answer: { background: colors.feedback.successSoft, border: colors.brand.tint, text: 'brand' },
  dimmed: { background: colors.surface.base, border: colors.border.subtle, text: 'tertiary' },
};

const A11Y_SUFFIX: Record<AnswerState, string> = {
  idle: '',
  correct: ', your answer, correct',
  wrong: ', your answer, not correct',
  answer: ', the correct answer',
  dimmed: '',
};

/**
 * One choice in a quiz. Right and wrong are shown with an icon as well as
 * color; a wrong pick shakes once, a right one pops.
 */
export function AnswerOption({ label, state, onPress, testID }: AnswerOptionProps) {
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    if (state === 'wrong') {
      shake.set(
        withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 60 }),
          withTiming(-6, { duration: 60 }),
          withTiming(5, { duration: 60 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    }
    if (state === 'correct') {
      pop.set(withSequence(withTiming(1.03, { duration: 110 }), withSpring(1, springs.press)));
    }
  }, [state, reduceMotion, shake, pop]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.get() }, { scale: pop.get() }],
  }));

  const look = LOOK[state];
  const answered = state !== 'idle';

  return (
    <Animated.View style={motionStyle}>
      <PressableScale
        testID={testID}
        disabled={answered}
        accessibilityRole="button"
        accessibilityLabel={`${label}${A11Y_SUFFIX[state]}`}
        accessibilityState={{
          disabled: answered,
          selected: state === 'correct' || state === 'wrong',
        }}
        onPress={onPress}
        style={[
          styles.option,
          {
            backgroundColor: look.background,
            borderColor: look.border,
            borderWidth: state === 'correct' || state === 'wrong' ? 2 : 1.5,
          },
        ]}>
        <AppText variant="bodyLarge" color={look.text} style={styles.label}>
          {label}
        </AppText>
        {state === 'correct' || state === 'answer' ? (
          <View style={[styles.mark, state === 'correct' ? styles.markRight : styles.markAnswer]}>
            <Check
              size={14}
              strokeWidth={3}
              color={state === 'correct' ? colors.text.inverse : colors.brand.primary}
            />
          </View>
        ) : state === 'wrong' ? (
          <View style={[styles.mark, styles.markWrong]}>
            <X size={14} strokeWidth={3} color={colors.text.inverse} />
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const MARK = 24;

const styles = StyleSheet.create({
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
  },
  label: { flex: 1 },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRight: { backgroundColor: colors.feedback.success },
  markAnswer: { borderWidth: 2, borderColor: colors.feedback.success },
  markWrong: { backgroundColor: colors.feedback.danger },
});
