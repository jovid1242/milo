import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';
import { z } from 'zod';

import { AppText, Button, Screen, TextField } from '@/components/ui';
import { EmailSchema, PasswordSchema } from '@/schemas';
import { spacing } from '@/theme';

import { AuthHeader } from './components/AuthHeader';
import { authErrorView } from './logic/auth-errors';
import { useSignUp } from './queries';

/**
 * Credentials only. The name and the goal are onboarding's, asked right after
 * this — never twice.
 */
const SignUpFormSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1, 'Repeat your password'),
  })
  .refine((form) => form.password === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match',
  });
type Form = z.input<typeof SignUpFormSchema>;
type Valid = z.output<typeof SignUpFormSchema>;

export function SignUpScreen() {
  const router = useRouter();
  const signUp = useSignUp();
  const password = useRef<TextInput>(null);
  const confirm = useRef<TextInput>(null);
  const { control, handleSubmit, setError, formState } = useForm<Form, unknown, Valid>({
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async ({ email, password: newPassword }) => {
    try {
      await signUp.mutateAsync({ email, password: newPassword });
    } catch (error) {
      const view = authErrorView(error);
      for (const [field, message] of Object.entries(view.fields))
        setError(field as keyof Form, { message });
      setError('root', { message: view.message });
    }
  });

  const backToSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <Screen scroll edges={['top', 'bottom']} testID="sign-up-screen">
      <View style={styles.content}>
        <AuthHeader title="Create your account" subtitle="Milo will ask your name and goal next." />
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="Email"
                defaultValue={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => password.current?.focus()}
                testID="sign-up-email"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField
                ref={password}
                label="Password"
                hint="At least 8 characters, with a letter and a number."
                defaultValue={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirm.current?.focus()}
                testID="sign-up-password"
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <TextField
                ref={confirm}
                label="Confirm password"
                defaultValue={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                testID="sign-up-confirm"
              />
            )}
          />
          {formState.errors.root?.message ? (
            <AppText variant="body" color="danger" accessibilityLiveRegion="polite">
              {formState.errors.root.message}
            </AppText>
          ) : null}
          <Button
            label="Create account"
            onPress={() => void submit()}
            loading={formState.isSubmitting}
            fullWidth
            testID="sign-up-submit"
          />
        </View>
        <View style={styles.switch}>
          <AppText variant="body" color="secondary">
            Already have an account?
          </AppText>
          <Button
            label="Log in"
            variant="secondary"
            size="md"
            onPress={backToSignIn}
            fullWidth
            testID="sign-up-log-in"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing[8], paddingVertical: spacing[6] },
  form: { gap: spacing[4] },
  switch: { alignItems: 'center', gap: spacing[3] },
});
