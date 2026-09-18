import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { CHALLENGE } from '@/constants/challenge';
import { effects, mascots } from '@/constants/assets';
import type { Chapter, ProgressState } from '@/schemas';
import { colors, spacing } from '@/theme';
import { formatNumber } from '@/utils/number';

export type DayHeaderProps = {
  chapter: Chapter;
  progress: ProgressState;
};

export function DayHeader({ chapter, progress }: DayHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <AppText variant="overline" color="wood">
          {`Chapter ${String(chapter.number).padStart(2, '0')} · ${chapter.title}`}
        </AppText>
        <View style={styles.dayRow}>
          <AppText variant="displayLarge">{`Day ${progress.currentDay}`}</AppText>
          <AppText variant="bodyLarge" color="tertiary">
            {`of ${CHALLENGE.totalDays}`}
          </AppText>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AssetImage asset={effects.streakFire} width={18} />
            <AppText variant="label" color={progress.streak > 0 ? 'primary' : 'tertiary'}>
              {progress.streak === 1 ? '1 day streak' : `${progress.streak} day streak`}
            </AppText>
          </View>
          <View style={styles.dot} />
          <AppText variant="label" color="reward">
            {`${formatNumber(progress.totalXp)} XP`}
          </AppText>
        </View>
      </View>
      <AssetImage asset={mascots.walking} width={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  text: { flex: 1, gap: spacing[1] },
  dayRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.border.default },
});
