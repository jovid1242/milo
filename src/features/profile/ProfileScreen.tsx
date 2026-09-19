import { useRouter } from 'expo-router';
import { Settings, Wrench } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ErrorState } from '@/components/ErrorState';
import { AppText, Avatar, Divider, LoadingState, Screen } from '@/components/ui';
import { durations, spacing } from '@/theme';

import { AchievementsPreview } from './components/AchievementsPreview';
import { JourneyCard } from './components/JourneyCard';
import { LinkRow } from './components/LinkRow';
import { ProfileStats } from './components/ProfileStats';
import { TeamCard } from './components/TeamCard';
import { useProfile } from './hooks/use-profile';

/** Once per app session: returning to the tab does not replay the entrance. */
const enter = (index: number) => FadeIn.duration(durations.normal).delay(60 + index * 50);

/**
 * The user's own overview — calm, not a social profile. Everything is a
 * projection of progress, badges and the team; the details live on their tabs.
 */
export function ProfileScreen() {
  const router = useRouter();
  const { view, error, retry } = useProfile();

  if (error) {
    return (
      <Screen background="warm">
        <ErrorState error={error} onRetry={retry} />
      </Screen>
    );
  }
  if (!view) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading your profile" />
      </Screen>
    );
  }

  return (
    <Screen scroll background="warm" testID="profile-screen">
      <View style={styles.content}>
        <Animated.View entering={enter(0)} style={styles.header}>
          <Avatar name={view.displayName} uri={view.avatarUrl} size="lg" />
          <View style={styles.headerText}>
            <AppText variant="title1" numberOfLines={2} accessibilityRole="header">
              {view.displayName}
            </AppText>
            <AppText variant="label" color="secondary">
              {`Day ${view.currentDay} of ${view.totalDays}`}
            </AppText>
            {view.chapterLine ? (
              <AppText variant="caption" color="wood">
                {view.chapterLine}
              </AppText>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <ProfileStats view={view} />
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <JourneyCard view={view} onOpen={() => router.navigate('/journey')} />
        </Animated.View>

        <Animated.View entering={enter(3)}>
          <AchievementsPreview view={view} onOpen={() => router.push('/achievements')} />
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <TeamCard view={view} onOpen={() => router.navigate('/friends')} />
        </Animated.View>

        <View style={styles.links}>
          <LinkRow
            icon={Settings}
            label="Settings"
            hint="Sound, haptics, your name and the app"
            onPress={() => router.push('/settings')}
          />
          {__DEV__ ? (
            <>
              <Divider />
              <LinkRow
                icon={Wrench}
                label="Developer tools"
                hint="Simulate progress, sounds and haptics"
                onPress={() => router.push('/dev-tools')}
              />
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[6] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  headerText: { flex: 1, gap: 2 },
  links: { gap: spacing[1], marginTop: spacing[2] },
});
