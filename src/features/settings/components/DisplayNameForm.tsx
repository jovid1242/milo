import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppText, Button } from '@/components/ui';
import { useUpdateDisplayName } from '@/features/profile/queries';
import { DisplayNameSchema } from '@/schemas';
import { playFeedback } from '@/services/feedback';
import { colors, radius, spacing, typography } from '@/theme';

const FormSchema = z.object({ displayName: DisplayNameSchema });
type FormValues = z.infer<typeof FormSchema>;

/** React Hook Form + the same Zod schema the repository validates against. */
export function DisplayNameForm({ initialName }: { initialName: string }) {
  const updateDisplayName = useUpdateDisplayName();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { displayName: initialName },
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async ({ displayName }) => {
    const user = await updateDisplayName.mutateAsync(displayName);
    reset({ displayName: user.displayName });
    playFeedback('importantAction');
  });

  const errorMessage =
    errors.displayName?.message ?? (updateDisplayName.isError ? 'Could not save your name.' : null);

  return (
    <View style={styles.form}>
      <AppText variant="label" color="secondary">
        Your name
      </AppText>
      <Controller
        control={control}
        name="displayName"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            onSubmitEditing={() => void onSubmit()}
            placeholder="How should Milo call you?"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="done"
            accessibilityLabel="Your name"
            style={[styles.input, errorMessage ? styles.inputError : null]}
          />
        )}
      />
      {errorMessage ? (
        <AppText variant="caption" color="danger">
          {errorMessage}
        </AppText>
      ) : null}
      <Button
        label="Save"
        size="md"
        onPress={() => void onSubmit()}
        disabled={!isDirty || !isValid}
        loading={isSubmitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[2] },
  input: {
    height: 54,
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
