import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { badges } from '@/constants/assets';
import { spacing } from '@/theme';

import type { AchievementStatus } from '../queries';

export function AchievementBadge({ status, size }: { status: AchievementStatus; size: number }) {
  const { achievement, unlockedAt } = status;
  const unlocked = unlockedAt !== null;

  return (
    <View style={[styles.item, { width: size }]}>
      <AssetImage
        asset={badges[achievement.id]}
        width={size}
        accessibilityLabel={`${achievement.title}. ${achievement.description} ${
          unlocked ? 'Unlocked.' : 'Locked.'
        }`}
        style={unlocked ? undefined : styles.locked}
      />
      <AppText
        variant="caption"
        color={unlocked ? 'secondary' : 'tertiary'}
        align="center"
        numberOfLines={1}>
        {achievement.title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: spacing[1] },
  locked: { opacity: 0.3 },
});
