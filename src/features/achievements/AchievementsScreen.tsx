import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { AppText, IconButton, LoadingState, ProgressBar, Screen } from '@/components/ui';
import type { AchievementCategory, AchievementId, AchievementStatus } from '@/schemas';
import { triggerHaptic } from '@/services/haptics/haptics';
import { spacing } from '@/theme';

import { AchievementDetailSheet } from './components/AchievementDetailSheet';
import { BadgeTile } from './components/BadgeTile';
import { CATEGORY_TITLES } from './logic/achievement-copy';
import { useAchievements } from './queries';

const COLUMNS = 2;
const CATEGORY_ORDER: AchievementCategory[] = ['consistency', 'learning', 'mastery', 'together'];

/** The badge collection: every badge visible, what it takes, how close the user is. */
export function AchievementsScreen() {
  const router = useRouter();
  const query = useAchievements();
  const [gridWidth, setGridWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<AchievementId | null>(null);

  if (query.isPending) {
    return (
      <Screen background="warm">
        <LoadingState label="Loading achievements" />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen background="warm">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const statuses = query.data;
  const unlocked = statuses.filter((status) => status.state === 'unlocked').length;
  const tileWidth = gridWidth > 0 ? (gridWidth - spacing[4] * (COLUMNS - 1)) / COLUMNS : 0;
  const selected = statuses.find((status) => status.achievement.id === selectedId) ?? null;

  const open = (status: AchievementStatus) => {
    triggerHaptic('selection');
    setSelectedId(status.achievement.id);
  };

  return (
    <Screen scroll background="warm" testID="achievements-screen">
      <View style={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.back}
          />
          <AppText variant="title1" accessibilityRole="header">
            Achievements
          </AppText>
          <View style={styles.summary}>
            <ProgressBar
              progress={unlocked / statuses.length}
              height={6}
              style={styles.summaryBar}
              accessibilityLabel={`${unlocked} of ${statuses.length} badges unlocked`}
            />
            <AppText variant="label" color="secondary">
              {`${unlocked} / ${statuses.length} unlocked`}
            </AppText>
          </View>
        </View>

        <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
          {tileWidth > 0
            ? CATEGORY_ORDER.map((category) => {
                const items = statuses.filter((status) => status.achievement.category === category);
                if (items.length === 0) return null;
                return (
                  <View key={category} style={styles.section}>
                    <AppText variant="overline" color="wood" accessibilityRole="header">
                      {CATEGORY_TITLES[category]}
                    </AppText>
                    <View style={styles.grid}>
                      {items.map((status) => (
                        <BadgeTile
                          key={status.achievement.id}
                          status={status}
                          width={tileWidth}
                          onPress={open}
                        />
                      ))}
                    </View>
                  </View>
                );
              })
            : null}
        </View>
      </View>
      <AchievementDetailSheet status={selected} onClose={() => setSelectedId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[6], paddingTop: spacing[2], paddingBottom: spacing[8] },
  header: { gap: spacing[2] },
  back: { marginLeft: -spacing[3] },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryBar: { flex: 1 },
  section: { gap: spacing[3], marginBottom: spacing[6] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing[4], rowGap: spacing[5] },
});
