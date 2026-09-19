import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ErrorState } from '@/components/ErrorState';
import {
  AppText,
  Avatar,
  IconButton,
  LoadingState,
  ProgressBar,
  Screen,
  SegmentedProgress,
  StatsRow,
  type Stat,
} from '@/components/ui';
import { ACHIEVEMENTS } from '@/data/content/achievements';
import { CHALLENGE } from '@/constants/challenge';
import { colors, durations, radius, spacing } from '@/theme';
import { formatNumber } from '@/utils/number';

import { StatusPill } from './components/StatusPill';
import { memberName, relativeTime } from './logic/team-copy';
import { useMemberDetails } from './queries';

const enter = (index: number) => FadeInDown.duration(durations.normal).delay(80 + index * 60);

/**
 * A teammate's challenge at a glance — not a social profile. Stats a member
 * does not share are left out, never shown as 0.
 */
export function FriendDetailScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const query = useMemberDetails(memberId);

  const back = (
    <IconButton
      icon={ChevronLeft}
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      style={styles.back}
    />
  );

  if (query.isPending) {
    return (
      <Screen background="warm">
        <LoadingState />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen background="warm">
        {back}
        <ErrorState
          title="Not in your team"
          message="This teammate is no longer part of your challenge."
          error={query.error ?? undefined}
          onRetry={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const { member, team } = query.data;
  const done = member.status === 'done';
  const questsDone = done ? team.questCount : (member.todayQuestsDone ?? null);
  const stats: Stat[] = [{ label: 'day streak', value: `${member.streak}` }];
  if (member.totalXp !== null) stats.push({ label: 'XP', value: formatNumber(member.totalXp) });
  if (member.achievementsUnlocked !== null) {
    stats.push({ label: 'badges', value: `${member.achievementsUnlocked}/${ACHIEVEMENTS.length}` });
  }
  const hidden = member.totalXp === null || member.achievementsUnlocked === null;

  return (
    <Screen scroll background="warm" testID="member-screen">
      <View style={styles.content}>
        {back}
        <Animated.View entering={enter(0)} style={styles.hero}>
          <Avatar name={member.displayName} uri={member.avatarUrl} size="xl" />
          <AppText variant="title1" accessibilityRole="header">
            {memberName(member)}
          </AppText>
          <AppText variant="label" color="secondary">
            {`Day ${team.currentDay} of ${CHALLENGE.totalDays}`}
            {member.lastActivityAt ? ` · Active ${relativeTime(member.lastActivityAt)}` : ''}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant="overline" color="wood">
              Today
            </AppText>
            <StatusPill status={member.status} />
          </View>
          {questsDone !== null ? (
            <>
              <AppText variant="title3">{`${questsDone} / ${team.questCount} quests`}</AppText>
              <SegmentedProgress groups={[team.questCount]} done={questsDone} />
            </>
          ) : (
            <AppText variant="body" color="secondary">
              {`${memberName(member)} doesn't share today's quests.`}
            </AppText>
          )}
        </Animated.View>

        <Animated.View entering={enter(2)} style={styles.card}>
          <AppText variant="overline" color="wood">
            Journey
          </AppText>
          <AppText variant="title3">{`${member.journeyDays} / ${CHALLENGE.totalDays} days completed`}</AppText>
          <ProgressBar
            progress={member.journeyDays / CHALLENGE.totalDays}
            height={6}
            accessibilityLabel={`${member.journeyDays} of ${CHALLENGE.totalDays} days completed`}
          />
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.card}>
          <StatsRow stats={stats} />
          {hidden ? (
            <AppText variant="caption" color="tertiary" align="center">
              Some stats are private.
            </AppText>
          ) : null}
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[8] },
  back: { marginLeft: -spacing[3] },
  hero: { alignItems: 'center', gap: spacing[2] },
  card: {
    gap: spacing[2],
    padding: spacing[5],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
