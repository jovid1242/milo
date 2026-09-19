import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { TRAIL, type TrailDot, type TrailSegment } from '../logic/map-layout';

export type Keyed<T> = T & { id: number };

/**
 * The trail: short solid capsules behind the user (their round ends overlap
 * into one smooth line) and small dots ahead — plain views, no large canvas.
 */
export const TrailPieces = memo(function TrailPieces({
  walked,
  ahead,
}: {
  walked: readonly Keyed<TrailSegment>[];
  ahead: readonly Keyed<TrailDot>[];
}) {
  return (
    <>
      {walked.map((segment) => (
        <View
          key={`w${segment.id}`}
          style={[
            styles.segment,
            {
              left: segment.x - (segment.length + TRAIL.thickness) / 2,
              top: segment.y - TRAIL.thickness / 2,
              width: segment.length + TRAIL.thickness,
              transform: [{ rotate: `${segment.angle}deg` }],
            },
          ]}
        />
      ))}
      {ahead.map((dot) => (
        <View
          key={`a${dot.id}`}
          style={[styles.dot, { left: dot.x - TRAIL.dotSize / 2, top: dot.y - TRAIL.dotSize / 2 }]}
        />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  segment: {
    position: 'absolute',
    height: TRAIL.thickness,
    borderRadius: TRAIL.thickness / 2,
    backgroundColor: colors.trail.walked,
  },
  dot: {
    position: 'absolute',
    width: TRAIL.dotSize,
    height: TRAIL.dotSize,
    borderRadius: TRAIL.dotSize / 2,
    backgroundColor: colors.trail.ahead,
  },
});
