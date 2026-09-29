import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';
import type { z } from 'zod';

import { AppText, Button, Screen, TextField } from '@/components/ui';
import { LoginRequestSchema, type LoginRequest } from '@/schemas';
import { spacing } from '@/theme';

import { AuthHeader } from './components/AuthHeader';
import { authErrorView } from './logic/auth-errors';
import { useSignIn } from './queries';

type Form = z.input<typeof LoginRequestSchema>;

/** Email and password, with the same schema the API checks them against. */
export function SignInScreen() {
  const router = useRouter();
  const signIn = useSignIn();
  const password = useRef<TextInput>(null);
  const { control, handleSubmit, setError, formState } = useForm<Form, unknown, LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const submit = handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
    } catch (error) {
      const view = authErrorView(error);
      for (const [field, message] of Object.entries(view.fields))
        setError(field as keyof Form, { message });
      setError('root', { message: view.message });
    }
  });

  return (
    <Screen scroll edges={['top', 'bottom']} testID="sign-in-screen">
      <View style={styles.content}>
        <AuthHeader title="Welcome back" subtitle="Log in to carry on with your 90 days." />
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
                testID="sign-in-email"
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
                defaultValue={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                testID="sign-in-password"
              />
            )}
          />
          {formState.errors.root?.message ? (
            <AppText variant="body" color="danger" accessibilityLiveRegion="polite">
              {formState.errors.root.message}
            </AppText>
          ) : null}
          <Button
            label="Log in"
            onPress={() => void submit()}
            loading={formState.isSubmitting}
            fullWidth
            testID="sign-in-submit"
          />
        </View>
        <View style={styles.switch}>
          <AppText variant="body" color="secondary">
            New to Milo?
          </AppText>
          <Button
            label="Create account"
            variant="secondary"
            size="md"
            onPress={() => router.push('/sign-up')}
            fullWidth
            testID="sign-in-create-account"
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
