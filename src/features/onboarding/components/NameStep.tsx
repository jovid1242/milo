import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { colors, durations, radius, spacing, typography } from '@/theme';

import { nameError } from '../logic/onboarding';

export type NameStepProps = {
  name: string;
  onChange: (name: string) => void;
  onSubmit: () => void;
};

/**
 * Step five: a name to be called by — nothing else. A plain form on purpose:
 * the keyboard opens at once, and the button rides above it.
 */
export function NameStep({ name, onChange, onSubmit }: NameStepProps) {
  const error = nameError(name);

  return (
    <View style={styles.step} testID="onboarding-name">
      <Animated.View entering={FadeInUp.duration(durations.normal)} style={styles.text}>
        <AppText variant="title2" accessibilityRole="header">
          What should Milo call you?
        </AppText>
        <AppText variant="body" color="secondary">
          Just a name — you can change it later in Settings.
        </AppText>
      </Animated.View>

      <View style={styles.field}>
        <TextInput
          value={name}
          onChangeText={onChange}
          onSubmitEditing={() => {
            // VoiceOver hears why the return key did nothing.
            if (error) AccessibilityInfo.announceForAccessibility(error);
            onSubmit();
          }}
          placeholder="Your name"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          autoCorrect={false}
          autoFocus
          maxLength={24}
          maxFontSizeMultiplier={typography.bodyLarge.maxFontSizeMultiplier}
          returnKeyType="next"
          submitBehavior="blurAndSubmit"
          accessibilityLabel="Your name"
          accessibilityHint="Between 2 and 24 characters"
          testID="onboarding-name-input"
          style={[styles.input, error ? styles.inputError : null]}
        />
        {error ? (
          <AppText
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="onboarding-name-error">
            {error}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  text: { gap: spacing[2] },
  field: { gap: spacing[2] },
  input: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.warm,
    backgroundColor: colors.surface.warm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    ...typography.bodyLarge.style,
  },
  inputError: { borderColor: colors.feedback.danger },
});
