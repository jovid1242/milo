import { Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import type { ProfileView } from '../logic/profile-view';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The team in one line — the Friends tab has the rest. */
export function TeamCard({ view, onOpen }: { view: ProfileView; onOpen: () => void }) {
  const { team } = view;
  const line = team
    ? team.members > 1
      ? `${plural(team.members, 'member')} · ${team.teamStreak > 0 ? `${team.teamStreak}-day team streak` : 'Team streak not started yet'}`
      : 'Your team is ready for friends.'
    : 'Climb the 90 days together with friends.';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Users size={18} color={colors.text.brand} strokeWidth={2.2} />
        </View>
        <View style={styles.text} accessible accessibilityLabel={`Team. ${line}`}>
          <AppText variant="overline" color="wood">
            Team
          </AppText>
          <AppText variant="bodyStrong">{line}</AppText>
        </View>
      </View>
      <Button
        label={team && team.members > 1 ? 'View team' : 'Invite friends'}
        variant="ghost"
        size="sm"
        onPress={onOpen}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[2],
    padding: spacing[5],
    paddingBottom: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  cta: { marginLeft: -spacing[3] },
});
