import { Check, Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { QuestIcon } from '@/features/quests/components/QuestIcon';
import { colors, radius, shadows, springs } from '@/theme';

import type { JourneyStep } from '../logic/today-journey';

/** Done steps shrink behind you, upcoming ones preview, the current one leads. */
export const DONE_NODE_SIZE = 32;
export const UPCOMING_NODE_SIZE = 44;
const CURRENT_ICON = 48;
const RING_STROKE = 2.5;
const RING_GAP = 3;
export const CURRENT_NODE_SIZE = CURRENT_ICON + 2 * (RING_GAP + RING_STROKE);

export type QuestNodeProps = {
  step: JourneyStep;
  /** Set when this quest was just completed: the check pops in. */
  celebrateKey: number | null;
};

/**
 * One waypoint of today's route, drawn with the quest's own icon. The current
 * quest wears a ring (a gold arc while in progress), done quests a green check,
 * locked ones fade back.
 */
export function QuestNode({ step, celebrateKey }: QuestNodeProps) {
  const { status, quest } = step;
  const reduceMotion = useReducedMotion();
  const bump = useSharedValue(1);
  const check = useSharedValue(status === 'completed' ? 1 : 0);

  useEffect(() => {
    if (status !== 'completed') {
      check.set(0);
      return;
    }
    if (celebrateKey === null || reduceMotion) {
      check.set(1);
      return;
    }
    bump.set(withSequence(withTiming(1.12, { duration: 140 }), withSpring(1, springs.bouncy)));
    check.set(
      withSequence(withTiming(0, { duration: 0 }), withDelay(90, withSpring(1, springs.bouncy))),
    );
  }, [status, celebrateKey, reduceMotion, bump, check]);

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, check.get() * 2),
    transform: [{ scale: check.get() }],
  }));

  if (status === 'available' || status === 'inProgress') {
    return (
      <View style={styles.current}>
        <ProgressRing progress={status === 'inProgress' ? step.progress : null} />
        <QuestIcon type={quest.type} size={CURRENT_ICON} />
      </View>
    );
  }

  const size = status === 'completed' ? DONE_NODE_SIZE : UPCOMING_NODE_SIZE;

  return (
    <Animated.View style={[{ width: size, height: size }, bumpStyle]}>
      <View style={status === 'locked' ? styles.faded : null}>
        <QuestIcon type={quest.type} size={size} />
      </View>
      {status === 'completed' ? (
        <Animated.View style={[styles.badge, styles.checkBadge, checkStyle]}>
          <Check size={10} color={colors.text.inverse} strokeWidth={3.5} />
        </Animated.View>
      ) : (
        <View style={[styles.badge, styles.lockBadge]}>
          <Lock size={10} color={colors.text.tertiary} strokeWidth={2.5} />
        </View>
      )}
    </Animated.View>
  );
}

/** Rounded square traced clockwise from the top centre, so progress reads like a clock. */
function roundedSquarePath(origin: number, side: number, corner: number): string {
  const start = origin;
  const end = origin + side;
  const mid = origin + side / 2;
  const arc = (x: number, y: number) => `A ${corner} ${corner} 0 0 1 ${x} ${y}`;
  return [
    `M ${mid} ${start}`,
    `H ${end - corner}`,
    arc(end, start + corner),
    `V ${end - corner}`,
    arc(end - corner, end),
    `H ${start + corner}`,
    arc(start, end - corner),
    `V ${start + corner}`,
    arc(start + corner, start),
    'Z',
  ].join(' ');
}

/**
 * Rounded-square ring that follows the icon's shape. `null` = ready to start
 * (full forest ring); a number = in progress (gold arc over a soft track).
 */
function ProgressRing({ progress }: { progress: number | null }) {
  const size = CURRENT_NODE_SIZE;
  const side = size - RING_STROKE;
  const corner = side * 0.3;
  const perimeter = 4 * side - 8 * corner + 2 * Math.PI * corner;
  const shown = progress === null ? 1 : Math.max(0.06, Math.min(1, progress));
  const path = roundedSquarePath(RING_STROKE / 2, side, corner);

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Path
        d={path}
        fill={colors.surface.base}
        stroke={progress === null ? colors.brand.primary : colors.reward.goldSoft}
        strokeWidth={RING_STROKE}
      />
      {progress !== null ? (
        <Path
          d={path}
          fill="none"
          stroke={colors.reward.goldDeep}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${perimeter * shown} ${perimeter}`}
        />
      ) : null}
    </Svg>
  );
}

const BADGE = 16;

const styles = StyleSheet.create({
  current: {
    width: CURRENT_NODE_SIZE,
    height: CURRENT_NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CURRENT_NODE_SIZE * 0.3,
    ...shadows.subtle,
  },
  faded: { opacity: 0.45 },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: BADGE,
    height: BADGE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.warm,
  },
  checkBadge: { backgroundColor: colors.feedback.success },
  lockBadge: { backgroundColor: colors.surface.warmStrong },
});
