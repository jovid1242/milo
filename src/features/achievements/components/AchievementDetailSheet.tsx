import { Check, Lock, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, Badge, Button, ProgressBar, Sheet } from '@/components/ui';
import type { AchievementStatus } from '@/schemas';
import { spacing } from '@/theme';
import { clamp } from '@/utils/number';

import { progressLabel, remainingLabel, unlockedOn } from '../logic/achievement-copy';
import { BadgeArt } from './AchievementBadge';

/** A badge up close: what it takes, and where the user stands — stored facts only. */
export function AchievementDetailSheet({
  status,
  onClose,
}: {
  /** `null` closes the sheet. */
  status: AchievementStatus | null;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  // Keeps showing the last badge while the sheet slides away.
  const [shown, setShown] = useState(status);
  if (status && status !== shown) setShown(status);

  return (
    <Sheet visible={status !== null} onClose={onClose} closeLabel="Close badge details">
      {shown ? (
        <View style={styles.body} testID="achievement-sheet">
          <View style={styles.art}>
            <BadgeArt status={shown} size={clamp(Math.round(width * 0.42), 140, 190)} />
          </View>
          <View style={styles.titles}>
            <AppText variant="title2" align="center" accessibilityRole="header">
              {shown.achievement.title}
            </AppText>
            <AppText variant="body" color="secondary" align="center">
              {shown.achievement.description}
            </AppText>
          </View>

          <View style={styles.state}>
            {shown.state === 'unlocked' ? (
              <>
                <Badge label="Unlocked" tone="brand" icon={Check} style={styles.chip} />
                {shown.unlockedAt ? (
                  <AppText variant="caption" color="secondary">
                    {unlockedOn(shown.unlockedAt)}
                  </AppText>
                ) : null}
              </>
            ) : shown.state === 'notAvailable' ? (
              <>
                <Badge label="Needs a team" tone="wood" icon={Users} style={styles.chip} />
                <AppText variant="caption" color="secondary" align="center">
                  Invite friends to your challenge: a team streak grows on the days everyone
                  finishes.
                </AppText>
              </>
            ) : (
              <>
                <Badge label="Locked" tone="neutral" icon={Lock} style={styles.chip} />
                {shown.progress ? (
                  <View style={styles.progress}>
                    <AppText variant="label">{progressLabel(shown)}</AppText>
                    <View style={styles.bar}>
                      <ProgressBar
                        progress={shown.progress.current / shown.progress.target}
                        height={6}
                        accessibilityLabel={`${shown.achievement.title} progress`}
                      />
                    </View>
                    {remainingLabel(shown) ? (
                      <AppText variant="caption" color="secondary">
                        {remainingLabel(shown)}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
            {shown.achievement.xpReward > 0 && shown.state !== 'notAvailable' ? (
              <AppText variant="caption" color="reward">
                {shown.state === 'unlocked'
                  ? `Earned +${shown.achievement.xpReward} XP`
                  : `Worth +${shown.achievement.xpReward} XP`}
              </AppText>
            ) : null}
          </View>

          <Button label="Close" variant="ghost" onPress={onClose} fullWidth haptic={null} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  art: { alignItems: 'center' },
  titles: { gap: spacing[1] },
  state: { alignItems: 'center', gap: spacing[2] },
  chip: { alignSelf: 'center' },
  progress: { alignSelf: 'stretch', alignItems: 'center', gap: spacing[1] },
  bar: { alignSelf: 'stretch', paddingHorizontal: spacing[8] },
});
