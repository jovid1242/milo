import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  label: string;
  /** Shown instead of the hint, and outlines the field. */
  error?: string | null;
  hint?: string;
  ref?: Ref<TextInput>;
};

/**
 * A labelled text input in the app's warm style, with its error right below
 * it. Forms pass `defaultValue` and listen with `onChangeText`: an
 * uncontrolled field never has its text rewritten by a render that is a
 * keystroke behind, so fast typing and AutoFill never lose characters.
 */
export function TextField({ label, error, hint, ref, ...input }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color="secondary">
        {label}
      </AppText>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.text.tertiary}
        maxFontSizeMultiplier={typography.bodyLarge.maxFontSizeMultiplier}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...input}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
