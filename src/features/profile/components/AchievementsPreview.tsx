import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { BadgeArt } from '@/features/achievements/components/AchievementBadge';
import { colors, radius, spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { RECENT_BADGES, type ProfileView } from '../logic/profile-view';

/** The latest badges — only earned ones; the full collection is one tap away. */
export function AchievementsPreview({ view, onOpen }: { view: ProfileView; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const { achievements } = view;
  const size = clamp(Math.round((width - 40 - 40 - spacing[3] * 3) / RECENT_BADGES), 56, 84);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="title3" accessibilityRole="header">
          Achievements
        </AppText>
        <AppText variant="label" color="secondary">
          {`${achievements.unlocked} / ${achievements.total} unlocked`}
        </AppText>
      </View>
      {achievements.recent.length > 0 ? (
        <View style={styles.row}>
          {achievements.recent.map((status) => (
            <View
              key={status.achievement.id}
              style={[styles.badge, { width: size }]}
              accessible
              accessibilityLabel={`${status.achievement.title}, unlocked`}>
              <BadgeArt status={status} size={size} />
              <AppText variant="caption" color="secondary" align="center" numberOfLines={2}>
                {status.achievement.title}
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="body" color="secondary">
          Your first badge is waiting at the end of Day 1.
        </AppText>
      )}
      <Button
        label="View all"
        variant="ghost"
        size="sm"
        onPress={onOpen}
        style={styles.cta}
        testID="profile-view-achievements"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
    padding: spacing[5],
    paddingBottom: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  row: { flexDirection: 'row', gap: spacing[3] },
  badge: { alignItems: 'center', gap: spacing[1] },
  cta: { marginLeft: -spacing[3] },
});
