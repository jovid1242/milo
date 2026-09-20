import { Image } from 'expo-image';
import { StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { chapters } from '@/constants/assets';
import { colors, durations, radius, spacing, typography } from '@/theme';

import { nameError } from '../logic/onboarding';

export type NameStepProps = {
  name: string;
  onChange: (name: string) => void;
  onSubmit: () => void;
  /** Keeps the art out of the way while the keyboard is up. */
  compact: boolean;
};

/**
 * Step five: a name to be called by, and the first chapter waiting. The field
 * does not steal the focus — the last thing onboarding shows is where the
 * ninety days begin, not a keyboard.
 */
export function NameStep({ name, onChange, onSubmit, compact }: NameStepProps) {
  const { width, height } = useWindowDimensions();
  const artHeight = Math.round(Math.min(width * 0.44, height * 0.22));
  const error = nameError(name);

  return (
    <View style={styles.step} testID="onboarding-name">
      {compact ? null : (
        <Animated.View
          entering={FadeIn.duration(durations.slow)}
          exiting={FadeIn.duration(durations.fast)}
          style={[styles.art, { height: artHeight }]}>
          <Image
            source={chapters.beginning.source}
            contentFit="cover"
            // The chapter's own lettering sits at the top of the illustration.
            contentPosition="top"
            accessibilityLabel="Chapter 01, The Beginning, days 1 to 10"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.duration(durations.normal).delay(100)} style={styles.text}>
        <AppText variant="title2" accessibilityRole="header">
          What should Milo call you?
        </AppText>
        <AppText variant="body" color="secondary">
          Just a name — it stays on this device.
        </AppText>
      </Animated.View>

      <View style={styles.field}>
        <TextInput
          value={name}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          placeholder="Your name"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          accessibilityLabel="Your name"
          testID="onboarding-name-input"
          style={[styles.input, error ? styles.inputError : null]}
        />
        {error ? (
          <AppText variant="caption" color="danger" testID="onboarding-name-error">
            {error}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  art: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface.warm },
  text: { gap: spacing[2] },
  field: { gap: spacing[2] },
  input: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.warm,
    backgroundColor: colors.surface.warm,
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    ...typography.bodyLarge.style,
  },
  inputError: { borderColor: colors.feedback.danger },
});
