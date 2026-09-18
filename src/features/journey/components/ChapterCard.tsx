import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, ProgressBar } from '@/components/ui';
import { chapters as chapterArt } from '@/constants/assets';
import type { Chapter } from '@/schemas';
import { colors, radius, spacing } from '@/theme';

export type ChapterStatus = 'completed' | 'current' | 'locked';

export type ChapterCardProps = {
  chapter: Chapter;
  status: ChapterStatus;
  /** Days of this chapter already completed. */
  completedDays: number;
  currentDay: number;
  width: number;
};

export function ChapterCard({
  chapter,
  status,
  completedDays,
  currentDay,
  width,
}: ChapterCardProps) {
  const totalDays = chapter.endDay - chapter.startDay + 1;
  const art = chapterArt[chapter.id];

  return (
    <View
      accessible
      accessibilityLabel={`Chapter ${chapter.number}, ${chapter.title}. ${chapter.tagline} ${
        status === 'locked'
          ? `Unlocks on day ${chapter.startDay}.`
          : `${completedDays} of ${totalDays} days completed.`
      }`}
      style={[styles.card, { width }]}>
      <View style={styles.imageWrap}>
        <AssetImage asset={art} width={width} contentFit="cover" />
        {status === 'locked' ? <View style={styles.lockVeil} /> : null}

        <View style={styles.badge}>
          {status === 'locked' ? (
            <Badge label={`Day ${chapter.startDay}`} tone="neutral" icon={Lock} />
          ) : status === 'completed' ? (
            <Badge label="Completed" tone="reward" icon={Check} />
          ) : (
            <Badge label={`Day ${currentDay}`} tone="brand" />
          )}
        </View>

        {status === 'current' ? (
          <LinearGradient
            colors={['rgba(21, 26, 22, 0)', 'rgba(21, 26, 22, 0.75)']}
            style={styles.footer}>
            <AppText variant="label" color="inverse">
              {`${completedDays} of ${totalDays} days`}
            </AppText>
            <ProgressBar
              progress={totalDays === 0 ? 0 : completedDays / totalDays}
              height={6}
              accessibilityLabel={`${chapter.title} progress`}
            />
          </LinearGradient>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface.warm },
  imageWrap: { position: 'relative' },
  lockVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 253, 248, 0.68)' },
  badge: { position: 'absolute', top: spacing[3], left: spacing[3] },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    gap: spacing[2],
  },
});
