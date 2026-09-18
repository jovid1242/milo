import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

export type DottedTrailProps = {
  orientation: 'horizontal' | 'vertical';
  color: string;
  /** Dot diameter. */
  thickness?: number;
  /** Distance between dot centers. */
  gap?: number;
};

/**
 * The way ahead, drawn like a trail on a hand-drawn map. Fills its parent and
 * measures itself, so it works for connectors of any length.
 */
export function DottedTrail({ orientation, color, thickness = 3, gap = 8 }: DottedTrailProps) {
  const [length, setLength] = useState(0);
  const vertical = orientation === 'vertical';
  const half = thickness / 2;

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLength(Math.round(vertical ? height : width));
      }}>
      {length > thickness ? (
        <Svg
          width={vertical ? thickness : length}
          height={vertical ? length : thickness}
          style={vertical ? styles.vertical : styles.horizontal}>
          <Line
            x1={half}
            y1={half}
            x2={vertical ? half : length - half}
            y2={vertical ? length - half : half}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`0.01 ${gap}`}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, justifyContent: 'center', pointerEvents: 'none' },
  vertical: { alignSelf: 'center' },
  horizontal: { alignSelf: 'flex-start' },
});
