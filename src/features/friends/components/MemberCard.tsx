import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Avatar, PressableScale, SegmentedProgress } from '@/components/ui';
import { effects } from '@/constants/assets';
import { colors, durations, radius, spacing } from '@/theme';

import { formatNumber } from '@/utils/number';

import type { MemberView } from '../logic/team';
import { STATUS_LABELS, memberName, memberTodayLine } from '../logic/team-copy';
import { StatusPill } from './StatusPill';

export type MemberCardProps = {
  member: MemberView;
  /** Just joined: the card enters with a short fade. */
  justJoined: boolean;
  onPress: (member: MemberView) => void;
};

/** One teammate: who, their day, how today goes, streak and XP. Compact — the team is the point. */
export const MemberCard = memo(function MemberCard({
  member,
  justJoined,
  onPress,
}: MemberCardProps) {
  const done = member.status === 'done';
  const questsDone = done ? member.questCount : member.todayQuestsDone;
  const name = memberName(member);
  const xp = `${formatNumber(member.totalXp)} XP`;

  return (
    <Animated.View
      entering={justJoined ? FadeInDown.duration(durations.slow) : undefined}
      layout={LinearTransition.duration(durations.normal)}>
      <PressableScale
        onPress={() => onPress(member)}
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${memberTodayLine(member)}. ${STATUS_LABELS[member.status]}. ${member.streak} day streak. ${xp}.`}
        accessibilityHint="Shows their challenge progress"
        style={[styles.card, done && styles.cardDone]}
        testID={`member-${member.userId}`}>
        <Avatar name={member.displayName} uri={member.avatarUrl} />
        <View style={styles.body}>
          <View style={styles.top}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {name}
            </AppText>
            <StatusPill status={member.status} />
          </View>
          <AppText variant="caption" color="secondary">
            {memberTodayLine(member)}
          </AppText>
          <View style={styles.bottom}>
            {member.questCount > 0 ? (
              <SegmentedProgress groups={[member.questCount]} done={questsDone} segmentWidth={18} />
            ) : (
              <View />
            )}
            <View style={styles.numbers}>
              <AppText variant="caption" color="secondary">
                {xp}
              </AppText>
              <View style={styles.streak}>
                <AssetImage
                  asset={effects.streakFire}
                  width={16}
                  style={member.streak === 0 ? styles.unlit : undefined}
                />
                <AppText variant="label" color={member.streak > 0 ? 'primary' : 'tertiary'}>
                  {member.streak}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  cardDone: { borderColor: colors.brand.tint },
  body: { flex: 1, gap: spacing[1] },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { flex: 1 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  unlit: { opacity: 0.35 },
});
