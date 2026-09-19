import type { ChapterId, DayNumber, Journey, JourneyDay } from '@/schemas';
import { clamp } from '@/utils/number';

/**
 * The 90-day map as geometry. Everything is derived from the screen width and
 * the journey, so the same model drives rendering, auto-scroll and tests:
 *
 *   top      Summit (Day 90) on the summit scene
 *            gate: Chapter 05
 *            Days 89 … 61 (Growth)       ← one scenery illustration per chapter
 *            gate: Chapter 04
 *            …
 *            Days 10 … 1 (Beginning)
 *            gate: Chapter 01
 *   bottom   Base camp — where the trail starts
 *
 * Days sit on a gentle sine wave (one swing every 8 days), so the trail
 * meanders upwards instead of forming a straight timeline.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Side = 'left' | 'right';

export type MapNode = { day: DayNumber; x: number; y: number; size: number };

export type SceneryKey = 'path' | 'forest' | 'river' | 'mountains';

export type MapScenery = Rect & { key: SceneryKey; chapterId: ChapterId };
export type MapGate = Rect & { chapterId: ChapterId };
export type MapFlag = Rect & { day: DayNumber };
export type MapMilo = Rect & { day: DayNumber; facing: Side };

/** Trail pieces: solid behind the user, dotted ahead. */
export type TrailSegment = { x: number; y: number; length: number; angle: number };
export type TrailDot = { x: number; y: number };

export type MapBand = { chapterId: ChapterId; top: number; bottom: number };

export type MapLayout = {
  width: number;
  height: number;
  /** Index = day - 1. */
  nodes: MapNode[];
  walked: TrailSegment[];
  ahead: TrailDot[];
  gates: MapGate[];
  scenery: MapScenery[];
  flags: MapFlag[];
  milo: MapMilo;
  summit: Rect;
  camp: Rect;
  bands: MapBand[];
};

/** Asset aspect ratios (height / width), mirrored from the registry. */
export type MapArtRatios = {
  camp: number;
  summit: number;
  gate: number;
  milo: number;
  flag: number;
  scenery: Record<SceneryKey, number>;
};

export const NODE_SIZES = { regular: 28, special: 36, today: 44, summit: 58 } as const;
export const TRAIL = { thickness: 6, dotSize: 5, spacing: 11 } as const;

const SCENERY_BY_CHAPTER: Partial<Record<ChapterId, SceneryKey>> = {
  beginning: 'path',
  momentum: 'forest',
  habit: 'river',
  growth: 'mountains',
};

export function mapMetrics(width: number) {
  return {
    margin: 16,
    gap: Math.round(clamp(width * 0.15, 54, 66)),
    amplitude: width * 0.26,
    center: width / 2,
    gateWidth: width - 40,
    gateGap: 28,
    miloWidth: clamp(Math.round(width * 0.15), 54, 64),
    flagWidth: 40,
  };
}

/** Horizontal position of the trail at a (fractional) day: one swing every 8 days. */
export function trailX(width: number, day: number): number {
  const { center, amplitude } = mapMetrics(width);
  return center + amplitude * Math.sin((Math.PI * (day - 1)) / 4);
}

function nodeSize(day: JourneyDay): number {
  if (day.kind === 'summit') return NODE_SIZES.summit;
  if (day.isToday) return NODE_SIZES.today;
  return day.kind === 'regular' ? NODE_SIZES.regular : NODE_SIZES.special;
}

const circleHitsRect = (node: MapNode, rect: Rect, margin: number) => {
  const r = node.size / 2 + margin;
  const nearestX = clamp(node.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(node.y, rect.y, rect.y + rect.height);
  return (node.x - nearestX) ** 2 + (node.y - nearestY) ** 2 < r * r;
};

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Something beside a node: tries the preferred side first, keeps clear of other nodes. */
function besideNode(
  node: MapNode,
  size: { width: number; height: number },
  preferred: Side,
  nodes: readonly MapNode[],
  width: number,
  margin: number,
  obstacles: readonly Rect[] = [],
): (Rect & { side: Side }) | null {
  for (const side of [preferred, preferred === 'left' ? 'right' : 'left'] as const) {
    const x =
      side === 'left'
        ? node.x - node.size / 2 - 4 - size.width
        : node.x + node.size / 2 + 4;
    const rect = { x, y: node.y + node.size / 2 - size.height + 6, ...size, side };
    const fits = rect.x >= margin / 2 && rect.x + rect.width <= width - margin / 2;
    const clear =
      nodes.every((other) => other === node || !circleHitsRect(other, rect, 2)) &&
      obstacles.every((obstacle) => !rectsOverlap(obstacle, rect));
    if (fits && clear) return rect;
  }
  return null;
}

/** The side away from where the trail goes next — free space around a node. */
function freeSide(width: number, day: DayNumber): Side {
  const next = trailX(width, day + 0.5) - trailX(width, day);
  return next > 0 ? 'left' : 'right';
}

export function buildMapLayout(journey: Journey, width: number, ratios: MapArtRatios): MapLayout {
  const m = mapMetrics(width);
  const chapters = journey.chapters.map((entry) => entry.chapter);
  const summitChapter = chapters.at(-1);
  if (!summitChapter) throw new Error('The journey has no chapters');

  // Heights are accumulated bottom-up (h = distance from the map's bottom edge)
  // and flipped to top-down coordinates at the end.
  let h = 24;
  const campWidth = Math.min(width * 0.62, 280);
  const campHeight = campWidth * ratios.camp;
  const campBottom = h;
  h += campHeight + 8;
  const trailStart = h - 18; // the trail leaves the camp from its upper edge

  const gateHeight = m.gateWidth * ratios.gate;
  const gatesUp: { chapterId: ChapterId; bottom: number }[] = [];
  const dayHeight = new Map<DayNumber, number>();
  const bandsUp: { chapterId: ChapterId; bottom: number; top: number }[] = [];

  let summitBottom = 0;
  const summitWidth = width * 0.94;
  const summitHeight = summitWidth * ratios.summit;

  for (const chapter of chapters) {
    const bandBottom = h;
    h += m.gateGap;
    gatesUp.push({ chapterId: chapter.id, bottom: h });
    h += gateHeight + m.gateGap;

    if (chapter.id === summitChapter.id) {
      // The summit scene holds the last day(s); its node sits on the stone steps.
      summitBottom = h;
      for (const day of rangeOf(chapter.startDay, chapter.endDay)) {
        dayHeight.set(day, summitBottom + summitHeight * 0.4);
      }
      h += summitHeight + 16;
    } else {
      h += m.gap * 0.55;
      for (const day of rangeOf(chapter.startDay, chapter.endDay)) {
        dayHeight.set(day, h);
        if (day < chapter.endDay) h += m.gap;
      }
      h += m.gap * 0.55;
    }
    bandsUp.push({ chapterId: chapter.id, bottom: bandBottom, top: h });
  }
  const height = Math.ceil(h + 8);
  const top = (up: number) => height - up;

  const nodes = journey.days.map((day): MapNode => {
    const up = dayHeight.get(day.day);
    if (up === undefined) throw new Error(`Day ${day.day} is outside every chapter`);
    const x = day.kind === 'summit' ? m.center : trailX(width, day.day);
    return { day: day.day, x, y: top(up), size: nodeSize(day) };
  });

  const gates = gatesUp.map(
    ({ chapterId, bottom }): MapGate => ({
      chapterId,
      x: (width - m.gateWidth) / 2,
      y: top(bottom + gateHeight),
      width: m.gateWidth,
      height: gateHeight,
    }),
  );
  const summit: Rect = {
    x: (width - summitWidth) / 2,
    y: top(summitBottom + summitHeight),
    width: summitWidth,
    height: summitHeight,
  };
  const camp: Rect = {
    x: (width - campWidth) / 2,
    y: top(campBottom + campHeight),
    width: campWidth,
    height: campHeight,
  };

  const scenery = placeScenery(journey, nodes, gates, width, ratios, m.margin);
  const milo = placeMilo(journey, nodes, width, ratios, m, {
    art: scenery,
    // On the summit Milo may stand on the scene itself.
    hard: journey.currentDay === journey.totalDays ? gates : [...gates, summit],
  });
  const flags = placeFlags(journey, nodes, milo, scenery, width, ratios, m);
  const { walked, ahead } = buildTrail(journey, nodes, width, {
    start: { x: m.center, y: top(trailStart) },
    hidden: [...gates, summit],
  });

  return {
    width,
    height,
    nodes,
    walked,
    ahead,
    gates,
    scenery,
    flags,
    milo,
    summit,
    camp,
    bands: bandsUp.map((band) => ({
      chapterId: band.chapterId,
      top: top(band.top),
      bottom: top(band.bottom),
    })),
  };
}

function rangeOf(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/**
 * One illustration per chapter, beside the trail where it swings furthest to
 * one side — the other side is free there for a few days.
 */
function placeScenery(
  journey: Journey,
  nodes: readonly MapNode[],
  gates: readonly MapGate[],
  width: number,
  ratios: MapArtRatios,
  margin: number,
): MapScenery[] {
  const placed: MapScenery[] = [];
  for (const { chapter } of journey.chapters) {
    const key = SCENERY_BY_CHAPTER[chapter.id];
    if (!key) continue;
    const middle = (chapter.startDay + chapter.endDay) / 2;
    // Days where the trail is at its widest swing, inside the chapter with room around.
    const extremes = rangeOf(chapter.startDay + 2, chapter.endDay - 2)
      .filter((day) => (day - 1) % 4 === 2)
      .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));

    for (const day of extremes) {
      const node = nodes[day - 1];
      if (!node) continue;
      const pathOnLeft = node.x < width / 2;
      const artWidth = width * (key === 'path' ? 0.4 : 0.5);
      const artHeight = artWidth * ratios.scenery[key];
      const rect = {
        x: pathOnLeft ? width - margin - artWidth : margin,
        y: node.y - artHeight / 2,
        width: artWidth,
        height: artHeight,
      };
      const clear =
        nodes.every((other) => !circleHitsRect(other, rect, 10)) &&
        gates.every((gate) => !rectsOverlap(gate, rect));
      if (clear) {
        placed.push({ ...rect, key, chapterId: chapter.id });
        break;
      }
    }
  }
  return placed;
}

/**
 * Milo stands beside today's node, on the side the trail does not continue to.
 * On narrow screens he gets smaller first; if art is in the way he may stand in
 * front of it — but never on a day node.
 */
function placeMilo(
  journey: Journey,
  nodes: readonly MapNode[],
  width: number,
  ratios: MapArtRatios,
  m: ReturnType<typeof mapMetrics>,
  obstacles: { art: readonly Rect[]; hard: readonly Rect[] },
): MapMilo {
  const node = nodes[journey.currentDay - 1];
  if (!node) throw new Error(`No node for day ${journey.currentDay}`);
  const preferred = freeSide(width, journey.currentDay);
  const sizes = [m.miloWidth, m.miloWidth - 8, m.miloWidth - 16];
  const passes = [[...obstacles.art, ...obstacles.hard], obstacles.hard];

  for (const avoid of passes) {
    for (const miloWidth of sizes) {
      const size = { width: miloWidth, height: miloWidth * ratios.milo };
      const spot = besideNode(node, size, preferred, nodes, width, m.margin, avoid);
      // Walking towards the node.
      if (spot) return { ...spot, day: node.day, facing: spot.side === 'left' ? 'right' : 'left' };
    }
  }
  throw new Error(`No room for Milo beside day ${node.day} at ${width}pt`);
}

/** A flag marks the end of each chapter, and the summit once it is reached. */
function placeFlags(
  journey: Journey,
  nodes: readonly MapNode[],
  milo: MapMilo,
  scenery: readonly MapScenery[],
  width: number,
  ratios: MapArtRatios,
  m: ReturnType<typeof mapMetrics>,
): MapFlag[] {
  const flags: MapFlag[] = [];
  for (const day of journey.days) {
    // Chapter ends carry a flag; the summit gets one once the journey is complete.
    const flagged = day.kind === 'chapterEnd' || (day.kind === 'summit' && journey.isComplete);
    if (!flagged) continue;
    const node = nodes[day.day - 1];
    if (!node) continue;
    const size = { width: m.flagWidth, height: m.flagWidth * ratios.flag };
    const spot = besideNode(node, size, freeSide(width, day.day), nodes, width, m.margin, [
      milo,
      ...scenery,
    ]);
    if (spot) flags.push({ ...spot, day: day.day });
  }
  return flags;
}

/**
 * Samples the trail from the camp through every day, evenly along its length.
 * Behind today it is solid (segments), ahead of today dotted. Parts under the
 * chapter gates and the summit scene are left out — the trail passes behind them.
 */
function buildTrail(
  journey: Journey,
  nodes: readonly MapNode[],
  width: number,
  options: { start: { x: number; y: number }; hidden: readonly Rect[] },
): { walked: TrailSegment[]; ahead: TrailDot[] } {
  type Sample = { x: number; y: number; progress: number };
  const dense: Sample[] = [];
  const stations = [
    { x: options.start.x, y: options.start.y, progress: 0 },
    ...nodes.map((node) => ({ x: node.x, y: node.y, progress: node.day })),
  ];
  for (let index = 1; index < stations.length; index++) {
    const from = stations[index - 1];
    const to = stations[index];
    if (!from || !to) continue;
    const steps = Math.max(2, Math.ceil(Math.abs(to.y - from.y) / 3));
    for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
      const t = step / steps;
      const progress = from.progress + (to.progress - from.progress) * t;
      // Between days the trail follows the sine; into the summit it eases to the centre.
      const onWave = index > 1 && to.progress < journey.totalDays;
      const x = onWave ? trailX(width, progress) : from.x + (to.x - from.x) * easeInOut(t);
      dense.push({ x, y: from.y + (to.y - from.y) * t, progress });
    }
  }

  // Even spacing along the curve.
  const samples: Sample[] = [];
  let carried = 0;
  for (let index = 0; index < dense.length; index++) {
    const point = dense[index];
    if (!point) continue;
    if (index === 0) {
      samples.push(point);
      continue;
    }
    const previous = dense[index - 1];
    if (!previous) continue;
    carried += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (carried >= TRAIL.spacing) {
      samples.push(point);
      carried = 0;
    }
  }

  const hidden = (x: number, y: number) =>
    options.hidden.some(
      (rect) => x > rect.x && x < rect.x + rect.width && y > rect.y + 6 && y < rect.y + rect.height - 6,
    );

  const walked: TrailSegment[] = [];
  const ahead: TrailDot[] = [];
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!sample || hidden(sample.x, sample.y)) continue;
    if (sample.progress > journey.currentDay) {
      ahead.push({ x: sample.x, y: sample.y });
      continue;
    }
    const next = samples[index + 1];
    if (!next || next.progress > journey.currentDay || hidden(next.x, next.y)) continue;
    const dx = next.x - sample.x;
    const dy = next.y - sample.y;
    walked.push({
      x: (sample.x + next.x) / 2,
      y: (sample.y + next.y) / 2,
      length: Math.hypot(dx, dy),
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return { walked, ahead };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Scroll offset that shows today's node a little below the middle, the way ahead above it. */
export function scrollOffsetFor(layout: MapLayout, day: DayNumber, viewportHeight: number): number {
  const node = layout.nodes[day - 1];
  if (!node) return 0;
  return clamp(node.y - viewportHeight * 0.58, 0, Math.max(0, layout.height - viewportHeight));
}
