import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { badges, effects, type ImageAsset } from '@/constants/assets';
import { ACHIEVEMENTS } from '@/data/content/achievements';
import { useCourseDay } from '@/features/course/queries';
import { QuestIcon } from '@/features/quests/components/QuestIcon';
import { colors, durations, radius, spacing } from '@/theme';

import { aboutMinutes } from '../logic/onboarding';

/** What showing up earns, in three glances: the streak, the badges, the team. */
const KEEPS: readonly { asset: ImageAsset; title: string; hint: string }[] = [
  { asset: effects.streakFire, title: 'Streak', hint: 'Every day in a row' },
  { asset: badges.firstDay, title: 'Badges', hint: `${ACHIEVEMENTS.length} to earn` },
  { asset: badges.teamStreak, title: 'Friends', hint: 'Better together' },
];

/**
 * Step three: what a day actually asks. The quests, their count and the time
 * they take come from Day 1's real plan — the day the user is about to start —
 * so this screen can never promise something the challenge does not do.
 */
export function DailyQuests() {
  const { fontScale } = useWindowDimensions();
  // With large text the icon moves above the words: beside them, a half-width
  // card leaves "Vocabulary" too little room and it breaks mid-word.
  const stacked = fontScale > 1.2;
  const plan = useCourseDay(1);
  const quests = plan.data?.quests ?? [];
  const minutes = aboutMinutes(quests.reduce((sum, quest) => sum + quest.estimatedMinutes, 0));

  return (
    <View style={styles.step} testID="onboarding-day">
      <Animated.View entering={FadeInUp.duration(durations.normal)} style={styles.text}>
        <AppText variant="title2" align="center" accessibilityRole="header">
          A little English every day.
        </AppText>
        {quests.length > 0 ? (
          <AppText variant="body" color="secondary" align="center">
            {/* No-break spaces keep "min a day" on one line when it wraps. */}
            {`${quests.length} short quests · about ${minutes}\u00A0min a\u00A0day`}
          </AppText>
        ) : null}
      </Animated.View>

      <View style={styles.grid}>
        {quests.map((quest, index) => (
          // Quest icons arrive one after another, in the order a day plays them.
          <Animated.View
            key={quest.id}
            entering={FadeInUp.duration(durations.normal).delay(120 + index * 80)}
            style={[styles.card, stacked && styles.cardStacked]}
            accessible
            accessibilityLabel={`${quest.title}: ${quest.summary}`}>
            <QuestIcon type={quest.type} size={36} />
            {/* Wraps rather than truncates: "Today's words again" must read whole. */}
            <View style={styles.cardText}>
              <AppText variant="bodyMedium">{quest.title}</AppText>
              <AppText variant="caption" color="secondary">
                {quest.summary}
              </AppText>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(480)} style={styles.keeps}>
        {KEEPS.map((keep) => (
          <View
            key={keep.title}
            style={styles.keep}
            accessible
            accessibilityLabel={`${keep.title}: ${keep.hint}`}>
            {/* One box for all three: the flame is wider than it is tall. */}
            <View style={styles.keepArt}>
              <AssetImage asset={keep.asset} width={44} />
            </View>
            <AppText variant="label" align="center">
              {keep.title}
            </AppText>
            <AppText variant="caption" color="secondary" align="center">
              {keep.hint}
            </AppText>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1, justifyContent: 'center', gap: spacing[5] },
  text: { gap: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.warm,
  },
  cardStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  cardText: { flexShrink: 1, gap: 2 },
  keeps: {
    flexDirection: 'row',
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.brandSoft,
  },
  keep: { flex: 1, alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[1] },
  keepArt: { height: 44, justifyContent: 'center' },
});
