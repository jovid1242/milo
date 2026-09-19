import { BookOpen, Mountain, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { effects } from '@/constants/assets';
import { colors, radius, spacing } from '@/theme';
import { formatNumber } from '@/utils/number';

import type { ProfileView } from '../logic/profile-view';

type Tile = { key: string; icon: ReactNode; value: string; label: string; spoken: string };

/**
 * Four numbers that mean something, in a 2×2 grid — it keeps its shape at
 * large text sizes where a row of four would crush the numbers.
 */
export function ProfileStats({ view }: { view: ProfileView }) {
  const { stats } = view;
  const tiles: Tile[] = [
    {
      key: 'streak',
      icon: <AssetImage asset={effects.streakFire} width={20} />,
      value: formatNumber(stats.streak),
      label: 'Day streak',
      spoken: `${stats.streak} day streak`,
    },
    {
      key: 'xp',
      icon: <Star size={18} color={colors.reward.goldDeep} fill={colors.reward.gold} />,
      value: formatNumber(stats.totalXp),
      label: 'Total XP',
      spoken: `${stats.totalXp} total XP`,
    },
    {
      key: 'days',
      icon: <Mountain size={18} color={colors.text.brand} strokeWidth={2.2} />,
      value: `${stats.completedDays} / ${view.totalDays}`,
      label: 'Days',
      spoken: `${stats.completedDays} of ${view.totalDays} days completed`,
    },
    {
      key: 'words',
      icon: <BookOpen size={18} color={colors.text.brand} strokeWidth={2.2} />,
      value: formatNumber(stats.wordsLearned),
      label: 'Words learned',
      spoken: `${stats.wordsLearned} words learned`,
    },
  ];

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View key={tile.key} style={styles.tile} accessible accessibilityLabel={tile.spoken}>
          <View style={styles.icon}>{tile.icon}</View>
          <AppText variant="statNumber" numberOfLines={1} adjustsFontSizeToFit>
            {tile.value}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {tile.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing[1],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  icon: { height: 22, justifyContent: 'center' },
});
