import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import type { Friend } from '@/schemas';
import { colors, radius, spacing } from '@/theme';

export function FriendRow({ friend }: { friend: Friend }) {
  return (
    <View
      accessible
      accessibilityLabel={`${friend.displayName}. Day ${friend.currentDay}, ${friend.streak} day streak. ${
        friend.completedToday ? 'Finished today.' : 'Still in progress.'
      }`}
      style={styles.row}>
      <Avatar name={friend.displayName} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{friend.displayName}</AppText>
        <AppText variant="caption" color="secondary">
          {`Day ${friend.currentDay} · ${friend.streak} day streak`}
        </AppText>
      </View>
      {friend.completedToday ? (
        <View style={styles.check}>
          <Check size={16} color={colors.text.inverse} strokeWidth={3} />
        </View>
      ) : (
        <AppText variant="caption" color="tertiary">
          In progress
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[3] },
  text: { flex: 1, gap: spacing[1] },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
