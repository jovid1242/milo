import { Check, Lock } from 'lucide-react-native';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components/ui';
import { quests } from '@/constants/assets';
import type { JourneyDay } from '@/schemas';
import { colors, springs } from '@/theme';

import { dayAccessibilityLabel } from '../logic/day-copy';
import type { MapNode } from '../logic/map-layout';

/** Small nodes still get a finger-sized target. */
const MIN_TOUCH = 48;

export type DayNodeProps = {
  node: MapNode;
  day: JourneyDay;
  /** Today's open day breathes gently while the map is on screen. */
  pulse: boolean;
  /** Set when the day was just completed: the node pops once. */
  revealKey: number | null;
  onPress: (day: JourneyDay) => void;
};

function Badge({ tone, size }: { tone: 'done' | 'locked'; size: number }) {
  const badge = Math.max(14, Math.round(size * 0.3));
  return (
    <View
      style={[
        styles.badge,
        { width: badge, height: badge, borderRadius: badge / 2 },
        tone === 'done' ? styles.badgeDone : styles.badgeLocked,
      ]}>
      {tone === 'done' ? (
        <Check size={badge * 0.62} color={colors.text.inverse} strokeWidth={3.5} />
      ) : (
        <Lock size={badge * 0.58} color={colors.text.inverse} strokeWidth={2.8} />
      )}
    </View>
  );
}

/**
 * One day on the map. State is never colour alone: done days carry a check,
 * locked ones a number in a quiet ring, missed ones a dashed ring, today a
 * bold ring (and Milo beside it). Exams and the summit show their quest icon.
 */
export const DayNode = memo(function DayNode({
  node,
  day,
  pulse,
  revealKey,
  onPress,
}: DayNodeProps) {
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(0);
  const pop = useSharedValue(1);
  const done = day.state === 'completed';
  const size = node.size;
  const touch = Math.max(MIN_TOUCH, size + 8);

  const breathing = pulse && !reduceMotion;
  useEffect(() => {
    if (!breathing) {
      cancelAnimation(ring);
      ring.set(0);
      return;
    }
    ring.set(withRepeat(withTiming(1, { duration: 1800 }), -1, false));
    return () => cancelAnimation(ring);
  }, [breathing, ring]);

  useEffect(() => {
    if (revealKey === null || reduceMotion) return;
    pop.set(withSequence(withTiming(0.7, { duration: 0 }), withSpring(1, springs.bouncy)));
  }, [revealKey, reduceMotion, pop]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - ring.get()),
    transform: [{ scale: 1 + ring.get() * 0.55 }],
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const Icon =
    day.kind === 'weeklyExam'
      ? quests.weeklyExam.Component
      : day.kind === 'summit'
        ? quests.finalBattle.Component
        : null;

  // Icons (exam, summit) always sit on white — the ring and a small badge tell the state.
  const stateStyle = done
    ? Icon
      ? day.kind === 'summit'
        ? styles.iconDoneGold
        : styles.iconDone
      : day.isToday
        ? styles.doneHighlight
        : styles.done
    : day.state === 'available'
      ? styles.today
      : day.state === 'missed'
        ? styles.missed
        : styles.locked;
  const circle = [styles.circle, { width: size, height: size, borderRadius: size / 2 }, stateStyle];

  let content;
  if (Icon) {
    content = <Icon width={size * 0.64} height={size * 0.64} />;
  } else if (done) {
    content = <Check size={size * 0.46} color={colors.text.inverse} strokeWidth={3.5} />;
  } else {
    content = (
      <AppText
        variant={day.state === 'available' ? 'bodyStrong' : 'label'}
        color={day.state === 'available' ? 'brand' : 'tertiary'}
        maxFontSizeMultiplier={1.1}>
        {day.day}
      </AppText>
    );
  }

  return (
    <PressableScale
      onPress={() => onPress(day)}
      accessibilityRole="button"
      accessibilityLabel={dayAccessibilityLabel(day)}
      accessibilityHint="Shows the day's details"
      style={[
        styles.touch,
        { left: node.x - touch / 2, top: node.y - touch / 2, width: touch, height: touch },
      ]}
      testID={`journey-day-${day.day}`}>
      {breathing ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, ringStyle]}
        />
      ) : null}
      <Animated.View style={[circle, popStyle]}>
        {content}
        {Icon && done ? <Badge tone="done" size={size} /> : null}
        {day.kind === 'summit' && day.state === 'locked' ? (
          <Badge tone="locked" size={size} />
        ) : null}
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  touch: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  done: {
    backgroundColor: colors.brand.primary,
    borderWidth: 2,
    borderColor: colors.surface.base,
  },
  doneHighlight: {
    backgroundColor: colors.brand.primary,
    borderWidth: 3,
    borderColor: colors.reward.gold,
  },
  today: {
    backgroundColor: colors.surface.base,
    borderWidth: 3,
    borderColor: colors.brand.primary,
  },
  missed: {
    backgroundColor: colors.surface.warm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.trail.ahead,
  },
  locked: {
    backgroundColor: colors.surface.base,
    borderWidth: 2,
    borderColor: colors.wood.light,
  },
  iconDone: {
    backgroundColor: colors.surface.base,
    borderWidth: 3,
    borderColor: colors.brand.primary,
  },
  iconDoneGold: {
    backgroundColor: colors.surface.base,
    borderWidth: 3,
    borderColor: colors.reward.gold,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.brand.primary,
  },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface.base,
  },
  badgeDone: { backgroundColor: colors.brand.primary },
  badgeLocked: { backgroundColor: colors.wood.base },
});
