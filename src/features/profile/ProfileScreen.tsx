import { useRouter } from 'expo-router';
import { Settings, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import {
  AppText,
  Avatar,
  Divider,
  LoadingState,
  ProgressBar,
  Screen,
  StatsRow,
} from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { useAchievements } from '@/features/achievements/queries';
import { AchievementBadge } from '@/features/achievements/components/AchievementBadge';
import { useProgressState } from '@/features/progress/queries';
import { spacing } from '@/theme';
import { formatNumber } from '@/utils/number';

import { LinkRow } from './components/LinkRow';
import { useUser } from './queries';

const BADGE_COLUMNS = 3;

export function ProfileScreen() {
  const router = useRouter();
  const user = useUser();
  const progress = useProgressState();
  const achievements = useAchievements();
  const [gridWidth, setGridWidth] = useState(0);

  if (user.isPending || progress.isPending || achievements.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading your profile" />
      </Screen>
    );
  }

  if (user.isError || progress.isError || achievements.isError) {
    return (
      <Screen>
        <ErrorState
          error={user.error ?? progress.error ?? achievements.error}
          onRetry={() => {
            void user.refetch();
            void progress.refetch();
            void achievements.refetch();
          }}
        />
      </Screen>
    );
  }

  const state = progress.data;
  const unlockedCount = achievements.data.filter((item) => item.state === 'unlocked').length;
  const badgeSize =
    gridWidth > 0 ? (gridWidth - spacing[4] * (BADGE_COLUMNS - 1)) / BADGE_COLUMNS : 0;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <Avatar name={user.data.displayName} size="lg" />
          <View style={styles.headerText}>
            <AppText variant="title1">{user.data.displayName}</AppText>
            <AppText variant="caption" color="secondary">
              {`Level ${state.level.level} · Day ${state.currentDay} of ${CHALLENGE.totalDays}`}
            </AppText>
          </View>
        </View>

        <View style={styles.section}>
          <StatsRow
            stats={[
              { label: 'XP', value: formatNumber(state.totalXp) },
              { label: 'Streak', value: `${state.streak}` },
              { label: 'Words', value: formatNumber(state.wordsLearned) },
              { label: 'Badges', value: `${unlockedCount}` },
            ]}
          />
          <ProgressBar
            progress={state.level.progress}
            accessibilityLabel={`Progress to level ${state.level.level + 1}`}
          />
          <AppText variant="caption" color="tertiary">
            {`${formatNumber(state.level.xpIntoLevel)} / ${formatNumber(state.level.xpForNextLevel)} XP to level ${state.level.level + 1}`}
          </AppText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="title3">Achievements</AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${unlockedCount} of ${achievements.data.length} unlocked. See all achievements`}
              hitSlop={12}
              onPress={() => router.push('/achievements')}
              testID="profile-see-all-achievements">
              <AppText variant="label" color="brand">
                {`${unlockedCount} of ${achievements.data.length} · See all`}
              </AppText>
            </Pressable>
          </View>
          <View
            style={styles.grid}
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
            {badgeSize > 0
              ? achievements.data.map((status) => (
                  <AchievementBadge key={status.achievement.id} status={status} size={badgeSize} />
                ))
              : null}
          </View>
        </View>

        <View style={styles.links}>
          <Divider />
          <LinkRow icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
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
  content: { gap: spacing[8], paddingTop: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  headerText: { flex: 1, gap: spacing[1] },
  section: { gap: spacing[3] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  links: { gap: spacing[1] },
});
