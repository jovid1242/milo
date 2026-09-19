import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import type { MapBand, MapGate } from '../logic/map-layout';

/**
 * Each chapter has its own light environment — warm cream at the camp, forest
 * green, river blue, cool mountain air, white snow at the summit. Plain colour
 * bands (cheap for a tall map) with a soft blend behind every chapter gate.
 */
export const MapBackground = memo(function MapBackground({
  bands,
  gates,
  height,
}: {
  bands: readonly MapBand[];
  gates: readonly MapGate[];
  height: number;
}) {
  const colorOf = (index: number) => {
    const band = bands[index];
    return band ? colors.journey[band.chapterId] : colors.journey.summit;
  };
  // Bands are listed bottom-up (Chapter 01 first); the map is drawn top-down.
  const top = bands.at(-1)?.top ?? 0;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <View
        style={[styles.fill, { top: 0, height: top, backgroundColor: colorOf(bands.length - 1) }]}
      />
      {bands.map((band, index) => (
        <View
          key={band.chapterId}
          style={[
            styles.fill,
            { top: band.top, height: band.bottom - band.top, backgroundColor: colorOf(index) },
          ]}
        />
      ))}
      <View
        style={[
          styles.fill,
          { top: bands[0]?.bottom ?? height, bottom: 0, backgroundColor: colorOf(0) },
        ]}
      />
      {gates.map((gate, index) =>
        index === 0 ? null : (
          <LinearGradient
            key={gate.chapterId}
            colors={[colorOf(index), colorOf(index - 1)]}
            style={[styles.fill, { top: gate.y - 24, height: gate.height + 80 }]}
          />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0 },
});
