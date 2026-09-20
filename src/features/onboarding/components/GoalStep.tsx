import {
  BookOpen,
  Briefcase,
  CalendarCheck,
  Check,
  Ear,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components/ui';
import type { Goal } from '@/schemas';
import { playFeedback } from '@/services/feedback';
import { colors, durations, radius, spacing } from '@/theme';

import { GOAL_OPTIONS } from '../logic/onboarding';

const ICONS: Record<Goal, LucideIcon> = {
  confidence: MessagesSquare,
  understanding: Ear,
  vocabulary: BookOpen,
  habit: CalendarCheck,
  workStudy: Briefcase,
};

export type GoalStepProps = {
  goal: Goal | null;
  onSelect: (goal: Goal) => void;
};

/** Step four: the one thing the user wants out of the ninety days. */
export function GoalStep({ goal, onSelect }: GoalStepProps) {
  return (
    <View style={styles.step} testID="onboarding-goal">
      <Animated.View entering={FadeInUp.duration(durations.normal)} style={styles.text}>
        <AppText variant="title2" accessibilityRole="header">
          What do you want most?
        </AppText>
        <AppText variant="body" color="secondary">
          Pick the one that fits best. Milo keeps it in mind.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(120)} style={styles.options}>
        {GOAL_OPTIONS.map((option) => {
          const selected = goal === option.goal;
          const Icon = ICONS[option.goal];
          return (
            <PressableScale
              key={option.goal}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
              testID={`goal-${option.goal}`}
              onPress={() => {
                playFeedback('answerSelect');
                onSelect(option.goal);
              }}>
              <Icon
                size={22}
                color={selected ? colors.brand.pressed : colors.text.secondary}
                strokeWidth={1.8}
              />
              <View style={styles.optionText}>
                <AppText variant="bodyMedium">{option.label}</AppText>
                <AppText variant="caption" color="secondary">
                  {option.hint}
                </AppText>
              </View>
              {selected ? <Check size={20} color={colors.brand.primary} strokeWidth={2.4} /> : null}
            </PressableScale>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  text: { gap: spacing[2] },
  options: { gap: spacing[3] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 64,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.base,
  },
  optionSelected: { borderColor: colors.border.brand, backgroundColor: colors.surface.brandSoft },
  optionText: { flex: 1, gap: spacing[1] },
});
