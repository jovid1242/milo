import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale, ProgressBar } from '@/components/ui';
import type { AchievementStatus } from '@/schemas';
import { spacing } from '@/theme';

import { statusLine } from '../logic/achievement-copy';
import { BadgeArt } from './AchievementBadge';

/**
 * One badge in the collection: the art leads, the title and one status line
 * follow — progress where it is real, the unlock date once earned.
 */
export const BadgeTile = memo(function BadgeTile({
  status,
  width,
  onPress,
}: {
  status: AchievementStatus;
  width: number;
  onPress: (status: AchievementStatus) => void;
}) {
  const { achievement, progress } = status;
  const unlocked = status.state === 'unlocked';
  const line = statusLine(status);

  return (
    <PressableScale
      onPress={() => onPress(status)}
      accessibilityRole="button"
      accessibilityLabel={`${achievement.title}. ${line}.`}
      accessibilityHint="Shows the badge's details"
      style={[styles.tile, { width }]}
      testID={`badge-${achievement.id}`}>
      <BadgeArt status={status} size={Math.round(width * 0.86)} />
      <View style={styles.text}>
        <AppText
          variant="bodyStrong"
          align="center"
          color={unlocked ? 'primary' : 'secondary'}
          numberOfLines={2}>
          {achievement.title}
        </AppText>
        <AppText
          variant="caption"
          align="center"
          color={unlocked ? 'brand' : status.state === 'notAvailable' ? 'wood' : 'tertiary'}
          numberOfLines={1}>
          {line}
        </AppText>
        {status.state === 'locked' && progress ? (
          <ProgressBar
            progress={progress.current / progress.target}
            height={4}
            style={styles.progress}
            accessibilityLabel={`${achievement.title} progress`}
          />
        ) : null}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { alignItems: 'center', gap: spacing[2], paddingBottom: spacing[2] },
  text: { alignSelf: 'stretch', alignItems: 'center', gap: 2, paddingHorizontal: spacing[1] },
  progress: { alignSelf: 'stretch', marginTop: spacing[1], marginHorizontal: spacing[4] },
});
