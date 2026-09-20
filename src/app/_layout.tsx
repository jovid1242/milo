import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { AchievementCelebrationHost } from '@/features/achievements/components/AchievementCelebrationHost';
import { needsOnboarding } from '@/features/onboarding/use-cases';
import { useUser } from '@/features/profile/queries';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { AppProviders } from '@/providers/app-providers';
import type { User } from '@/schemas';
import { colors, layout } from '@/theme';
import { fontSources } from '@/theme/fonts';
import { navigationTheme } from '@/theme/navigation-theme';

export { RootErrorBoundary as ErrorBoundary } from '@/components/RootErrorBoundary';

void SplashScreen.preventAutoHideAsync();

/**
 * Which app the user gets: a profile that never finished onboarding sees only
 * onboarding, and the moment the challenge starts every other route appears —
 * and onboarding is gone for good, beyond the reach of any back gesture.
 */
function AppNavigator({ initialUser }: { initialUser: User }) {
  const user = useUser();
  const onboarded = !needsOnboarding(user.data ?? initialUser);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.base },
        }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          {/* Gameplay is immersive: full screen, no tab bar, no swipe-away mid-quest. */}
          <Stack.Screen
            name="quest/[questId]"
            options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          {/* The end of a day: fades in over the last quest's result and closes
            with its own button, never by accident. */}
          <Stack.Screen
            name="day-complete/[day]"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
          {/* The summit: the whole challenge's finale, over the Final Battle's result. */}
          <Stack.Screen
            name="summit"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="settings" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="member/[memberId]" />
        </Stack.Protected>
        {/* First launch. No tabs, no gestures out: the only way on is Day 1. */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
        {/* Reachable from both sides — onboarding is a state to develop against
          too. The route itself redirects when `__DEV__` is false. */}
        <Stack.Screen name="dev-tools" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Achievement unlocks are celebrated here, on calm screens only. */}
      {onboarded ? <AchievementCelebrationHost /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontSources);
  const bootstrap = useAppBootstrap();
  const ready = (fontsLoaded || fontError !== null) && bootstrap.status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProviders>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="dark" />
            {bootstrap.status === 'error' || bootstrap.user === null ? (
              <View style={styles.startupError}>
                <ErrorState
                  title="Milo could not start"
                  message="The local database could not be opened."
                  error={bootstrap.error}
                  onRetry={bootstrap.retry}
                />
              </View>
            ) : (
              <AppNavigator initialUser={bootstrap.user} />
            )}
          </ThemeProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  startupError: {
    flex: 1,
    backgroundColor: colors.background.base,
    paddingHorizontal: layout.screenPaddingX,
    justifyContent: 'center',
  },
});
