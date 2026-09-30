import { useRouter } from 'expo-router';
import { UserPlus, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { AppText, Button, ConfirmSheet, IconButton, LoadingState, Screen } from '@/components/ui';
import { useOnline } from '@/hooks/use-online';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, radius, spacing } from '@/theme';

import { InviteSheet } from './components/InviteSheet';
import { JoinSheet } from './components/JoinSheet';
import { MemberCard } from './components/MemberCard';
import { TeamNotice } from './components/TeamNotice';
import { TeamSummary } from './components/TeamSummary';
import { useTeamMoments } from './hooks/use-team-moments';
import type { MemberView, TeamView } from './logic/team';
import { memberCount, relativeTime } from './logic/team-copy';
import { teamProblemOf, type TeamProblem } from './logic/team-errors';
import { useCreateTeam, useLeaveTeam, useTeam } from './queries';

/**
 * Friends: a team of up to three taking the same challenge. One question —
 * how is today going for us? — then who is where. The team comes from the
 * Milo API; the last answer stays on the phone, so offline the tab shows the
 * team as it was, and says so.
 */
export function FriendsScreen() {
  const { local, server } = useTeam();
  const online = useOnline();
  const moments = useTeamMoments(local.data?.kind === 'team' ? local.data.view : null);
  const [joining, setJoining] = useState(false);
  const create = useCreateTeam();

  if (local.isPending) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading your team" />
      </Screen>
    );
  }
  if (local.isError) {
    return (
      <Screen background="warm">
        <ErrorState error={local.error} onRetry={() => void local.refetch()} />
      </Screen>
    );
  }

  const state = local.data;
  const serverProblem = server.isError ? teamProblemOf(server.error) : null;
  // Offline, or the API out of reach: what is shown is the last answer.
  const cut = !online || serverProblem === 'offline';

  if (state.kind === 'unknown' && state.serverBacked) {
    // Nothing kept yet: the first answer is on its way, or needs a connection.
    return cut || server.isError ? (
      <Screen background="warm" testID="friends-unreachable">
        <EmptyState
          variant="noInternet"
          title={cut ? 'Internet connection required' : 'Your team could not load'}
          description={
            cut ? 'Your team lives on Milo’s server. Connect to see it.' : 'Try again in a moment.'
          }
          action={{ label: 'Try again', onPress: () => void server.refetch() }}
        />
      </Screen>
    ) : (
      <Screen background="warm">
        <LoadingState label="Loading your team" />
      </Screen>
    );
  }

  if (state.kind !== 'team') {
    const problem: TeamProblem | null = create.isError ? teamProblemOf(create.error) : null;
    return (
      <Screen background="warm" testID="friends-empty">
        {cut ? <OfflineNote asOf={null} deviceOffline={!online} /> : null}
        <EmptyState
          variant="noFriendsYet"
          title="Your journey is better together."
          description="Make a team of three friends and climb the 90 days together — or join a friend’s team."
          action={{
            label: 'Create team',
            onPress: () => create.mutate(),
            loading: create.isPending,
            testID: 'friends-create',
          }}
          secondaryAction={{
            label: 'Join with a code',
            onPress: () => setJoining(true),
            testID: 'friends-join',
          }}
          footer={
            problem ? (
              <View style={styles.footer}>
                <TeamNotice problem={problem} />
              </View>
            ) : !state.serverBacked ? (
              <View style={styles.footer}>
                <TeamNotice problem="unavailable" />
              </View>
            ) : null
          }
        />
        <JoinSheet visible={joining} onClose={() => setJoining(false)} />
      </Screen>
    );
  }

  return (
    <TeamScreen
      view={state.view}
      offline={cut ? (online ? 'unreachable' : 'offline') : null}
      stale={serverProblem !== null && serverProblem !== 'offline'}
      moments={moments}
    />
  );
}

function TeamScreen({
  view,
  offline,
  stale,
  moments,
}: {
  view: TeamView;
  /** Why the server's answer is not fresh: no connection, or the server out of reach. */
  offline: 'offline' | 'unreachable' | null;
  /** The server answered with a problem: what shows is the last good answer. */
  stale: boolean;
  moments: ReturnType<typeof useTeamMoments>;
}) {
  const router = useRouter();
  const leave = useLeaveTeam();
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const alone = view.members.length === 1;

  const openMember = (member: MemberView) => {
    triggerHaptic('selection');
    router.push({ pathname: '/member/[memberId]', params: { memberId: member.userId } });
  };
  const invite = () => setInviting(true);
  const confirmLeave = () => {
    setLeaving(false);
    leave.mutate(view.id);
  };
  const me = view.members.find((member) => member.isCurrentUser);

  return (
    <Screen scroll background="warm" testID="friends-screen">
      <View style={styles.content}>
        {offline ? <OfflineNote asOf={view.asOf} deviceOffline={offline === 'offline'} /> : null}
        {!offline && stale ? (
          <View style={styles.offline}>
            <AppText variant="caption" color="secondary" style={styles.offlineText}>
              {`Your team could not update just now. As of ${relativeTime(view.asOf)}.`}
            </AppText>
          </View>
        ) : null}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="overline" color="wood" testID="team-count">
              {`${view.name} · ${view.members.length}/${view.capacity}`}
            </AppText>
            <AppText variant="title1" accessibilityRole="header">
              Friends
            </AppText>
          </View>
          {!view.isFull ? (
            <IconButton
              icon={UserPlus}
              variant="soft"
              accessibilityLabel="Invite friends"
              onPress={invite}
              testID="friends-invite"
            />
          ) : null}
        </View>

        {alone ? (
          // A team of one: no "team day" to report yet — just the way to fill it.
          <View style={styles.alone} testID="team-alone">
            <AppText variant="overline" color="wood">
              {view.invite ? `Code ${view.invite.code}` : memberCount(1, view.capacity)}
            </AppText>
            <AppText variant="title2">Your team is ready.</AppText>
            <AppText variant="body" color="secondary">
              Invite two friends to climb with you. Your team streak starts on the first day you all
              finish.
            </AppText>
            <Button
              label="Invite friends"
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
              key={member.userId}
              member={member}
              justJoined={moments.joinedIds.includes(member.userId)}
              onPress={openMember}
            />
          ))}
        </View>

        {!alone && !view.isFull ? (
          <Button
            label={`Invite a friend · ${view.capacity - view.members.length} place left`}
            icon={UserPlus}
            variant="ghost"
            onPress={invite}
            style={styles.centered}
          />
        ) : null}
        {view.isFull ? (
          <AppText variant="caption" color="secondary" align="center" testID="team-full">
            Your team is full: three friends, one challenge.
          </AppText>
        ) : null}

        {leave.isError ? <TeamNotice problem={teamProblemOf(leave.error)} /> : null}
        <Button
          label="Leave team"
          variant="ghost"
          size="sm"
          onPress={() => setLeaving(true)}
          loading={leave.isPending}
          style={styles.centered}
          testID="friends-leave"
        />
      </View>
      <InviteSheet visible={inviting} onClose={() => setInviting(false)} view={view} />
      <ConfirmSheet
        visible={leaving}
        title="Leave the team?"
        message={
          alone
            ? 'You’re its only member: the team and its invite go away. Your own progress stays yours.'
            : me?.isOwner
              ? 'Your own progress stays yours. The team goes on with the others — whoever joined first after you looks after it.'
              : 'Your own progress stays yours. The team goes on without you.'
        }
        stayLabel="Stay in the team"
        leaveLabel="Leave team"
        onStay={() => setLeaving(false)}
        onLeave={confirmLeave}
      />
    </Screen>
  );
}

/** The team as last heard of, offline — said plainly, with when. */
function OfflineNote({ asOf, deviceOffline }: { asOf: string | null; deviceOffline: boolean }) {
  const why = deviceOffline ? "You're offline." : 'Milo’s server can’t be reached right now.';
  return (
    <View style={styles.offline} accessibilityRole="alert" testID="friends-offline">
      <WifiOff size={16} color={colors.text.secondary} />
      <AppText variant="caption" color="secondary" style={styles.offlineText}>
        {asOf
          ? `${why} This is your team as of ${relativeTime(asOf)} — it updates once the connection is back.`
          : `${why} Creating or joining a team needs an internet connection.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[6] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: spacing[1], flex: 1 },
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
  centered: { alignSelf: 'center' },
  footer: { alignSelf: 'stretch' },
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
