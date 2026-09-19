import { useRouter } from 'expo-router';
import { UserPlus, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, IconButton, LoadingState, Screen } from '@/components/ui';
import { useOnline } from '@/hooks/use-online';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, radius, spacing } from '@/theme';

import { InviteSheet } from './components/InviteSheet';
import { MemberCard } from './components/MemberCard';
import { TeamActivityList } from './components/TeamActivityList';
import { TeamSummary } from './components/TeamSummary';
import { useTeamMoments } from './hooks/use-team-moments';
import type { MemberView } from './logic/team';
import { useTeam, useTeamActivity } from './queries';

/**
 * Friends: a small team taking the same challenge. One question — how is
 * today going for us? — then who is where, and a few recent moments.
 */
export function FriendsScreen() {
  const router = useRouter();
  const team = useTeam();
  const activity = useTeamActivity();
  const [inviting, setInviting] = useState(false);
  const online = useOnline();
  const view = team.data ?? null;
  const moments = useTeamMoments(view);

  if (team.isPending) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading your team" />
      </Screen>
    );
  }
  if (team.isError) {
    return (
      <Screen background="warm">
        <ErrorState error={team.error} onRetry={() => void team.refetch()} />
      </Screen>
    );
  }

  const invite = () => setInviting(true);
  const sheet = <InviteSheet visible={inviting} onClose={() => setInviting(false)} />;

  if (!view) {
    return (
      <Screen background="warm" testID="friends-empty">
        <EmptyState
          variant="noFriendsYet"
          title="Your journey is better together."
          description="Invite friends to join your 90-day challenge."
          action={{ label: 'Invite friend', onPress: invite }}
        />
        {sheet}
      </Screen>
    );
  }

  const openMember = (member: MemberView) => {
    triggerHaptic('selection');
    router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } });
  };
  const alone = view.members.length === 1;

  return (
    <Screen scroll background="warm" testID="friends-screen">
      <View style={styles.content}>
        {online ? null : (
          <View style={styles.offline} accessibilityRole="alert">
            <WifiOff size={16} color={colors.text.secondary} />
            <AppText variant="caption" color="secondary" style={styles.offlineText}>
              {"You're offline. Friends' progress will update when you're back online."}
            </AppText>
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="overline" color="wood">
              Our team
            </AppText>
            <AppText variant="title1" accessibilityRole="header">
              Friends
            </AppText>
          </View>
          <IconButton
            icon={UserPlus}
            variant="soft"
            accessibilityLabel="Invite friend"
            onPress={invite}
            testID="friends-invite"
          />
        </View>

        {alone ? (
          // A team of one: no "team day" to report yet — just the way to fill it.
          <View style={styles.alone} testID="team-alone">
            <AppText variant="overline" color="wood">
              {`Code ${view.team.inviteCode}`}
            </AppText>
            <AppText variant="title2">Your team is ready.</AppText>
            <AppText variant="body" color="secondary">
              Share your code so friends can climb with you. Your team streak starts on the first
              day you all finish.
            </AppText>
            <Button
              label="Invite friend"
              icon={UserPlus}
              onPress={invite}
              style={styles.aloneCta}
            />
          </View>
        ) : (
          <TeamSummary view={view} celebrateKey={moments.completeKey} />
        )}

        <View style={styles.members}>
          {view.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              view={view}
              justJoined={moments.joinedIds.includes(member.id)}
              onPress={openMember}
            />
          ))}
        </View>

        {activity.data && !alone ? (
          <TeamActivityList activity={activity.data} members={view.members} />
        ) : null}

        {!alone ? (
          <Button
            label="Invite friend"
            icon={UserPlus}
            variant="ghost"
            onPress={invite}
            style={styles.inviteMore}
          />
        ) : null}
      </View>
      {sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[6] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: spacing[1] },
  alone: {
    gap: spacing[2],
    padding: spacing[5],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  aloneCta: { marginTop: spacing[2] },
  members: { gap: spacing[3] },
  inviteMore: { alignSelf: 'center' },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.surface.warm,
  },
  offlineText: { flex: 1 },
});
