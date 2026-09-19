import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, ProgressBar } from '@/components/ui';
import { journey as journeyArt } from '@/constants/assets';
import { colors, radius, spacing } from '@/theme';

import type { ProfileView } from '../logic/profile-view';

const summitLine = (days: number) =>
  days === 0 ? 'Summit day' : days === 1 ? '1 day to the summit' : `${days} days to the summit`;

/** The whole challenge in one line; the map itself lives on the Journey tab. */
export function JourneyCard({ view, onOpen }: { view: ProfileView; onOpen: () => void }) {
  const { journey } = view;
  const complete = journey.completedDays === journey.totalDays;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View
          style={styles.text}
          accessible
          accessibilityLabel={`90 day journey. ${journey.completedDays} of ${journey.totalDays} days completed. ${complete ? 'Journey complete.' : summitLine(journey.daysToSummit)}.`}>
          <AppText variant="overline" color="wood">
            90 day journey
          </AppText>
          <AppText variant="title2">{`${journey.completedDays} / ${journey.totalDays}`}</AppText>
          <AppText variant="caption" color="secondary">
            {complete ? 'Journey complete' : summitLine(journey.daysToSummit)}
          </AppText>
        </View>
        <AssetImage asset={journeyArt.mountains} width={96} />
      </View>
      <ProgressBar
        progress={journey.progress}
        height={6}
        accessibilityLabel={`${journey.completedDays} of ${journey.totalDays} days completed`}
      />
      <Button label="View Journey" variant="ghost" size="sm" onPress={onOpen} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
    padding: spacing[5],
    paddingBottom: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
  cta: { marginLeft: -spacing[3] },
});
