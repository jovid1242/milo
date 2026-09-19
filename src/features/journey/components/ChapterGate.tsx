import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Badge, ProgressBar } from '@/components/ui';
import { chapters as chapterArt } from '@/constants/assets';
import type { DayNumber, JourneyChapter } from '@/schemas';
import { colors, radius, spacing } from '@/theme';

import type { MapGate } from '../logic/map-layout';

function badgeFor(entry: JourneyChapter) {
  switch (entry.state) {
    case 'completed':
      return <Badge label="Completed" tone="reward" icon={Check} />;
    case 'passed':
      return <Badge label={`${entry.completedDays} of ${entry.totalDays} days`} tone="neutral" />;
    case 'upcoming':
      return <Badge label="Locked" tone="neutral" icon={Lock} />;
    case 'current':
      return null;
  }
}

/**
 * The entrance to a chapter: its illustration (title and days are part of the
 * art), a status badge, and the chapter's progress while the user is in it.
 * Upcoming chapters are veiled lightly — still visible, just not reached.
 */
export const ChapterGate = memo(function ChapterGate({
  gate,
  entry,
  currentDay,
}: {
  gate: MapGate;
  entry: JourneyChapter;
  currentDay: DayNumber;
}) {
  const { chapter } = entry;
  const upcoming = entry.state === 'upcoming';
  const badge = badgeFor(entry);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Chapter ${chapter.number}, ${chapter.title}. Days ${chapter.startDay} to ${chapter.endDay}. ${
        upcoming
          ? `Starts on day ${chapter.startDay}.`
          : `${entry.completedDays} of ${entry.totalDays} days completed.`
      }`}
      style={[styles.gate, { left: gate.x, top: gate.y, width: gate.width, height: gate.height }]}>
      <View style={styles.card}>
        <AssetImage asset={chapterArt[chapter.id]} width={gate.width - 6} contentFit="cover" />
        {upcoming ? <View style={styles.veil} /> : null}
        {entry.state === 'current' ? (
          <LinearGradient
            colors={['rgba(21, 26, 22, 0)', 'rgba(21, 26, 22, 0.6)']}
            style={styles.footer}>
            <AppText variant="label" color="inverse">
              {`Day ${currentDay} · ${entry.completedDays} of ${entry.totalDays} ${entry.totalDays === 1 ? 'day' : 'days'} done`}
            </AppText>
            <ProgressBar progress={entry.completedDays / entry.totalDays} height={5} />
          </LinearGradient>
        ) : null}
      </View>
      {/* On the card's lower edge: the title and days are part of the art above. */}
      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  gate: { position: 'absolute' },
  card: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface.warm,
    borderWidth: 3,
    borderColor: colors.surface.base,
  },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 253, 248, 0.55)' },
  badge: { position: 'absolute', bottom: -12, right: spacing[4] },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
    gap: spacing[1],
  },
});
