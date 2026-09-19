import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { ACHIEVEMENTS } from '@/data/content/achievements';
import type { TeamActivity } from '@/schemas';
import { spacing } from '@/theme';

import type { MemberView } from '../logic/team';
import { activityText, memberName, relativeTime } from '../logic/team-copy';

const titleOf = (id: string) =>
  ACHIEVEMENTS.find((achievement) => achievement.id === id)?.title ?? 'a badge';

/** A few recent team moments — words built from structured events, not a feed. */
export function TeamActivityList({
  activity,
  members,
}: {
  activity: readonly TeamActivity[];
  members: readonly MemberView[];
}) {
  const now = new Date();
  const rows = activity.flatMap((event) => {
    const member = members.find((item) => item.id === event.memberId);
    return member ? [{ event, member }] : [];
  });
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <AppText variant="overline" color="wood" accessibilityRole="header">
        Recently
      </AppText>
      {rows.map(({ event, member }) => {
        const text = activityText(event, memberName(member), titleOf);
        const when = relativeTime(event.createdAt, now);
        return (
          <View
            key={event.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${text}, ${when}`}>
            <Avatar name={member.displayName} uri={member.avatarUrl} size="xs" />
            <AppText variant="body" style={styles.text} numberOfLines={2}>
              {text}
            </AppText>
            <AppText variant="caption" color="tertiary">
              {when}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  text: { flex: 1 },
});
