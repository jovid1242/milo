import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { AppText, Divider, LoadingState, Screen } from '@/components/ui';
import { effects } from '@/constants/assets';
import { useProgressState } from '@/features/progress/queries';
import { spacing } from '@/theme';

import { FriendRow } from './components/FriendRow';
import { computeTeamStreak } from './logic/team-streak';
import { useFriends } from './queries';

export function FriendsScreen() {
  const friends = useFriends();
  const progress = useProgressState();

  // `networkMode: 'online'` pauses this query while offline — that is the
  // offline state the friends list will really have once it talks to a server.
  if (friends.isPaused && !friends.data) {
    return (
      <Screen>
        <EmptyState
          variant="noInternet"
          title="You're offline"
          description="Your friends' progress will sync as soon as you're back online."
        />
      </Screen>
    );
  }

  if (friends.isPending || progress.isPending) {
    return (
      <Screen>
        <LoadingState label="Loading your team" />
      </Screen>
    );
  }

  if (friends.isError || progress.isError) {
    return (
      <Screen>
        <ErrorState
          error={friends.error ?? progress.error}
          onRetry={() => void friends.refetch()}
        />
      </Screen>
    );
  }

  if (friends.data.length === 0) {
    return (
      <Screen>
        <EmptyState
          variant="noFriendsYet"
          title="No friends yet"
          description="The challenge is better together. Invite your friends to climb with you."
        />
      </Screen>
    );
  }

  const teamStreak = computeTeamStreak(progress.data.streak, friends.data);

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="overline" color="wood">
            Team
          </AppText>
          <AppText variant="title1">Friends</AppText>
          <View style={styles.teamStreak}>
            <AssetImage asset={effects.streakFire} width={18} />
            <AppText variant="label" color={teamStreak > 0 ? 'primary' : 'tertiary'}>
              {teamStreak > 0 ? `Team streak · ${teamStreak} days` : 'No team streak yet'}
            </AppText>
          </View>
        </View>

        <View>
          {friends.data.map((friend, index) => (
            <Fragment key={friend.id}>
              {index > 0 ? <Divider inset={60} /> : null}
              <FriendRow friend={friend} />
            </Fragment>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[4] },
  header: { gap: spacing[1] },
  teamStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
});
