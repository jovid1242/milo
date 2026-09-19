import { Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { badges } from '@/constants/assets';
import type { AchievementStatus } from '@/schemas';
import { colors, spacing } from '@/theme';

import { statusLine } from '../logic/achievement-copy';

/** Locked badges stay recognisable: softened, with a small lock — never a grey slab. */
export const LOCKED_OPACITY = 0.42;

/** A badge image with its state marked: the art itself, softened while locked. */
export function BadgeArt({ status, size }: { status: AchievementStatus; size: number }) {
  const unlocked = status.state === 'unlocked';
  const lock = Math.max(18, Math.round(size * 0.2));
  return (
    <View>
      <AssetImage
        asset={badges[status.achievement.badge]}
        width={size}
        style={unlocked ? undefined : styles.locked}
      />
      {unlocked ? null : (
        <View
          style={[styles.lock, { width: lock, height: lock, borderRadius: lock / 2 }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Lock size={lock * 0.55} color={colors.text.inverse} strokeWidth={2.6} />
        </View>
      )}
    </View>
  );
}

/** Compact badge for the Profile summary. */
export function AchievementBadge({ status, size }: { status: AchievementStatus; size: number }) {
  const { achievement } = status;
  const unlocked = status.state === 'unlocked';
  return (
    <View
      style={[styles.item, { width: size }]}
      accessible
      accessibilityLabel={`${achievement.title}. ${statusLine(status)}.`}>
      <BadgeArt status={status} size={size} />
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
  locked: { opacity: LOCKED_OPACITY },
  lock: {
    position: 'absolute',
    right: '8%',
    bottom: '10%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wood.base,
    borderWidth: 2,
    borderColor: colors.surface.base,
  },
});
