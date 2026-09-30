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
import { AccountProfileSync } from '@/features/auth/components/AccountProfileSync';
import { SessionWatcher } from '@/features/auth/components/SessionWatcher';
import { PendingInviteWatcher } from '@/features/friends/components/PendingInviteWatcher';
import { needsOnboarding } from '@/features/onboarding/use-cases';
import { ReminderSync } from '@/features/reminders/components/ReminderSync';
import { useUser } from '@/features/profile/queries';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { AppProviders } from '@/providers/app-providers';
import { useAuthStore } from '@/stores/auth-store';
import { colors, layout } from '@/theme';
import { fontSources } from '@/theme/fonts';
import { navigationTheme } from '@/theme/navigation-theme';

export { RootErrorBoundary as ErrorBoundary } from '@/components/RootErrorBoundary';

void SplashScreen.preventAutoHideAsync();

/**
 * Which app the user gets. Signed out (with the Milo API on), only signing in
 * or up. Signed in, a profile that never finished onboarding sees only
 * onboarding, and the moment the challenge starts every other route appears —
 * and onboarding is gone for good, beyond the reach of any back gesture. In
 * local mode the device is always signed in.
 */
function AppNavigator() {
  const session = useAuthStore((state) => state.session);
  const signedIn = session !== null;
  // Signed out there is no profile to read; signed in, the session's first
  // reading routes the very first frame.
  const user = useUser({ enabled: signedIn });
  const profile = user.data ?? session?.initialUser ?? null;
  const onboarded = profile !== null && !needsOnboarding(profile);
  const inChallenge = signedIn && onboarded;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.base },
        }}>
        <Stack.Protected guard={inChallenge}>
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
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack.Protected>
        {/* Signed out: the account comes first; local progress waits, untouched. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
        {/* An invite link opens from any state: signed out or new, the invite
          waits for sign-in and the challenge (see PendingInviteWatcher). */}
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        {/* Reachable from both sides — onboarding is a state to develop against
          too. The route itself redirects when `__DEV__` is false. */}
        <Stack.Screen name="dev-tools" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Achievement unlocks are celebrated here, on calm screens only. */}
      {inChallenge ? <AchievementCelebrationHost /> : null}
      {/* Daily reminders follow the preferences and the challenge, from here. */}
      <ReminderSync onboarded={inChallenge} />
      <SessionWatcher />
      <PendingInviteWatcher inChallenge={inChallenge} />
      {signedIn ? <AccountProfileSync /> : null}
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
            {bootstrap.status === 'error' ? (
              <View style={styles.startupError}>
                <ErrorState
                  title="Milo could not start"
                  message="The local database could not be opened."
                  error={bootstrap.error}
                  onRetry={bootstrap.retry}
                />
              </View>
            ) : (
              <AppNavigator />
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
