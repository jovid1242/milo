import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { journey as journeyArt } from '@/constants/assets';
import type { Journey, JourneyChapter, JourneyDay } from '@/schemas';
import { colors, durations, radius, spacing } from '@/theme';

import { useRevealCompleted } from '../hooks/use-reveal-completed';
import { buildMapLayout, scrollOffsetFor, type MapFlag } from '../logic/map-layout';
import { MAP_ART_RATIOS, SCENERY_ART } from '../map-art';
import { recallMapScroll, rememberMapScroll } from '../scroll-memory';
import { ChapterGate } from './ChapterGate';
import { DayNode } from './DayNode';
import { MapBackground } from './MapBackground';
import { MiloMarker } from './MiloMarker';
import { TrailPieces } from './TrailPieces';

export type JourneyMapProps = {
  journey: Journey;
  onSelectDay: (day: JourneyDay) => void;
};

/** Only what is near the viewport is mounted: a screen and a half either way. */
const windowAround = (offset: number, viewport: number) => ({
  top: offset - viewport * 1.5,
  bottom: offset + viewport * 2.5,
});

function flagArt(day: JourneyDay, chapter: JourneyChapter | undefined) {
  if (day.state === 'completed') return journeyArt.flagComplete;
  if (chapter?.state === 'current') return journeyArt.flagCheckpoint;
  return journeyArt.flagNormal;
}

/**
 * The 90-day map. Opens on today (or where the user left it this session),
 * climbs from the base camp at the bottom to the summit at the top.
 */
export function JourneyMap(props: JourneyMapProps) {
  const [viewport, setViewport] = useState(0);
  return (
    <View style={styles.fill} onLayout={(event) => setViewport(event.nativeEvent.layout.height)}>
      {viewport > 0 ? <MapScroll {...props} viewport={viewport} /> : null}
    </View>
  );
}

function MapScroll({ journey, onSelectDay, viewport }: JourneyMapProps & { viewport: number }) {
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const layout = useMemo(() => buildMapLayout(journey, width, MAP_ART_RATIOS), [journey, width]);
  const scrollRef = useRef<ScrollView>(null);
  const [initialOffset] = useState(
    () =>
      recallMapScroll(journey.currentDay) ?? scrollOffsetFor(layout, journey.currentDay, viewport),
  );
  const [range, setRange] = useState(() => windowAround(initialOffset, viewport));
  const centredDay = useRef(journey.currentDay);
  const reveal = useRevealCompleted(journey, focused);

  // A new day (or a dev shortcut) moves the user: follow them.
  useEffect(() => {
    if (centredDay.current === journey.currentDay) return;
    centredDay.current = journey.currentDay;
    const offset = scrollOffsetFor(layout, journey.currentDay, viewport);
    setRange(windowAround(offset, viewport));
    scrollRef.current?.scrollTo({ y: offset, animated: true });
  }, [journey.currentDay, layout, viewport]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y < range.top + viewport * 0.5 || y + viewport > range.bottom - viewport * 0.5) {
      setRange(windowAround(y, viewport));
    }
  };
  const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    rememberMapScroll(event.nativeEvent.contentOffset.y, journey.currentDay);

  const walked = useMemo(() => layout.walked.map((piece, id) => ({ ...piece, id })), [layout]);
  const ahead = useMemo(() => layout.ahead.map((piece, id) => ({ ...piece, id })), [layout]);
  const near = (top: number, bottom: number) => bottom >= range.top && top <= range.bottom;
  const chapterOf = (id: string) => journey.chapters.find((entry) => entry.chapter.id === id);

  const summitNode = layout.nodes.at(-1);
  const summitDay = journey.days.at(-1);

  return (
    <ScrollView
      ref={scrollRef}
      contentOffset={{ x: 0, y: initialOffset }}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onScrollEndDrag={onSettle}
      onMomentumScrollEnd={onSettle}
      showsVerticalScrollIndicator={false}
      testID="journey-map">
      <View style={{ width, height: layout.height }}>
        <MapBackground bands={layout.bands} gates={layout.gates} height={layout.height} />

        {near(layout.camp.y, layout.camp.y + layout.camp.height) ? (
          <AssetImage
            asset={journeyArt.camp}
            width={layout.camp.width}
            style={[styles.art, { left: layout.camp.x, top: layout.camp.y }]}
          />
        ) : null}
        {layout.scenery
          .filter((art) => near(art.y, art.y + art.height))
          .map((art) => (
            <AssetImage
              key={art.key}
              asset={SCENERY_ART[art.key]}
              width={art.width}
              style={[styles.art, { left: art.x, top: art.y }]}
            />
          ))}

        <TrailPieces
          walked={walked.filter((piece) => near(piece.y, piece.y))}
          ahead={ahead.filter((piece) => near(piece.y, piece.y))}
        />

        {layout.gates
          .filter((gate) => near(gate.y, gate.y + gate.height))
          .map((gate) => {
            const entry = chapterOf(gate.chapterId);
            return entry ? (
              <ChapterGate
                key={gate.chapterId}
                gate={gate}
                entry={entry}
                currentDay={journey.currentDay}
              />
            ) : null;
          })}

        {near(layout.summit.y, layout.summit.y + layout.summit.height) ? (
          <AssetImage
            asset={journeyArt.summit}
            width={layout.summit.width}
            style={[styles.art, { left: layout.summit.x, top: layout.summit.y }]}
          />
        ) : null}

        {layout.campfire && near(layout.campfire.y, layout.campfire.y + layout.campfire.height) ? (
          <AssetImage
            asset={
              journey.days[layout.campfire.day - 1]?.state === 'completed'
                ? journeyArt.campfire
                : journeyArt.campfireOff
            }
            width={layout.campfire.width}
            transition={durations.reward}
            style={[styles.art, { left: layout.campfire.x, top: layout.campfire.y }]}
          />
        ) : null}

        {layout.flags
          .filter((flag) => near(flag.y, flag.y + flag.height))
          .map((flag: MapFlag) => {
            const day = journey.days[flag.day - 1];
            if (!day) return null;
            return (
              <AssetImage
                key={flag.day}
                asset={flagArt(day, chapterOf(day.chapterId))}
                width={flag.width}
                style={[styles.art, { left: flag.x, top: flag.y }]}
              />
            );
          })}

        {layout.nodes
          .filter((node) => near(node.y - node.size, node.y + node.size))
          .map((node) => {
            const day = journey.days[node.day - 1];
            return day ? (
              <DayNode
                key={node.day}
                node={node}
                day={day}
                pulse={focused && day.state === 'available'}
                revealKey={reveal.days.includes(node.day) ? reveal.key : null}
                onPress={onSelectDay}
              />
            ) : null;
          })}

        {summitNode && summitDay && near(summitNode.y, summitNode.y + 80) ? (
          <View
            pointerEvents="none"
            style={[
              styles.summitLabel,
              {
                top: summitNode.y + summitNode.size / 2 + spacing[2],
                width: 160,
                left: summitNode.x - 80,
              },
            ]}>
            <View style={styles.summitPill}>
              <AppText
                variant="overline"
                color={summitDay.state === 'completed' ? 'reward' : 'wood'}>
                {summitDay.state === 'completed' ? 'Summit reached' : 'Final challenge'}
              </AppText>
            </View>
          </View>
        ) : null}

        {near(layout.milo.y, layout.milo.y + layout.milo.height) ? (
          <MiloMarker milo={layout.milo} active={focused} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  art: { position: 'absolute' },
  summitLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  summitPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surface.base,
  },
});
