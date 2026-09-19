import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Avatar } from '@/components/ui';
import { effects } from '@/constants/assets';
import { colors, radius, spacing } from '@/theme';

import type { TeamView } from '../logic/team';
import { memberName, teamStreakCopy, todaySummary } from '../logic/team-copy';

/**
 * How today goes for the whole team, and the team streak. When the last
 * member finishes, the card turns gold with one soft sparkle — a small win
 * together, no sound on top of the day's own.
 */
export function TeamSummary({
  view,
  celebrateKey,
}: {
  view: TeamView;
  celebrateKey: number | null;
}) {
  const reduceMotion = useReducedMotion();
  const sparkle = useSharedValue(0);
  const today = todaySummary(view);
  const streak = teamStreakCopy(view);
  const complete = view.isTeamDayComplete;

  useEffect(() => {
    if (celebrateKey === null || reduceMotion) return;
    sparkle.set(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 900 })));
  }, [celebrateKey, reduceMotion, sparkle]);
  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkle.get() }));

  return (
    <View style={[styles.card, complete && styles.cardComplete]} testID="team-summary">
      {celebrateKey !== null && !reduceMotion ? (
        <Animated.View pointerEvents="none" style={[styles.sparkle, sparkleStyle]}>
          <AssetImage asset={effects.sparkles} width={220} />
        </Animated.View>
      ) : null}

      <View
        accessible
        accessibilityLabel={`Today. ${today.title}. ${today.line}`}
        style={styles.section}>
        <AppText variant="overline" color={complete ? 'reward' : 'wood'}>
          Today
        </AppText>
        <AppText variant="title2">{today.title}</AppText>
        <AppText variant="body" color="secondary">
          {today.line}
        </AppText>
        <View style={styles.people}>
          {view.members.map((member) => {
            const done = member.status === 'done';
            return (
              <View key={member.id} style={styles.person}>
                <Avatar
                  name={member.displayName}
                  uri={member.avatarUrl}
                  size="sm"
                  style={done ? styles.personDone : styles.personOpen}
                />
                {done ? (
                  <View style={styles.check}>
                    <Check size={11} color={colors.text.inverse} strokeWidth={3.5} />
                  </View>
                ) : null}
                <AppText variant="caption" color={done ? 'primary' : 'tertiary'} numberOfLines={1}>
                  {memberName(member)}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>

      {view.members.length > 1 ? (
        <>
          <View style={styles.divider} />
          <View
            accessible
            accessibilityLabel={`Team streak. ${streak.title}. ${streak.line}`}
            style={styles.streakRow}>
            <AssetImage
              asset={effects.streakFire}
              width={36}
              style={view.teamStreak === 0 ? styles.unlit : undefined}
            />
            <View style={styles.streakText}>
              <AppText variant="overline" color="wood">
                Team streak
              </AppText>
              <AppText variant="bodyStrong">{streak.title}</AppText>
              <AppText variant="caption" color="secondary">
                {streak.line}
              </AppText>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[5],
    gap: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
    overflow: 'hidden',
  },
  cardComplete: { backgroundColor: colors.reward.goldSoft, borderColor: colors.reward.gold },
  sparkle: { position: 'absolute', right: -40, top: -30 },
  section: { gap: spacing[1] },
  people: { flexDirection: 'row', gap: spacing[4], marginTop: spacing[3] },
  person: { alignItems: 'center', gap: spacing[1], maxWidth: 64 },
  personDone: { borderColor: colors.brand.primary, borderWidth: 2 },
  personOpen: { opacity: 0.75 },
  check: {
    position: 'absolute',
    top: 24,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderWidth: 1.5,
    borderColor: colors.surface.base,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.warm },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  streakText: { flex: 1, gap: 1 },
  unlit: { opacity: 0.35 },
});
