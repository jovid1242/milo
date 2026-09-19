import { CHAPTERS } from '@/data/content/chapters';
import { buildAllDailyChallenges } from '@/data/content/schedule';
import type { QuestCompletion } from '@/schemas';

import { buildJourney } from '../journey';
import {
  buildMapLayout,
  rectsOverlap,
  scrollOffsetFor,
  type MapArtRatios,
  type MapLayout,
  type Rect,
} from '../map-layout';

const PLANS = buildAllDailyChallenges();
const RATIOS: MapArtRatios = {
  camp: 800 / 1200,
  summit: 800 / 1200,
  gate: 0.6,
  milo: 702 / 768,
  flag: 311 / 252,
  scenery: { path: 1360 / 1156, forest: 800 / 1200, river: 800 / 1200, mountains: 800 / 1200 },
};
// iPhone SE / mini, iPhone 17 Pro, Pro Max.
const WIDTHS = [320, 375, 402, 440];

function journeyAt(currentDay: number, completedThrough: number) {
  const completions: QuestCompletion[] = PLANS.filter((plan) => plan.day <= completedThrough).flatMap(
    (plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 1,
        correctCount: 5,
        totalCount: 5,
        xpEarned: quest.xpReward,
        source: 'user' as const,
        completedAt: '2026-09-18T10:00:00.000Z',
      })),
  );
  return buildJourney({ plans: PLANS, chapters: CHAPTERS, completions, dayCompletions: [], currentDay });
}

const SCENARIOS: [string, number, number][] = [
  ['Day 1', 1, 0],
  ['Day 11', 11, 10],
  ['Day 30', 30, 29],
  ['Day 47', 47, 46],
  ['Day 60', 60, 59],
  ['Day 89 completed', 89, 89],
  ['Day 90', 90, 89],
  ['90 of 90', 90, 90],
];

const nodeRect = (node: MapLayout['nodes'][number], margin = 0): Rect => ({
  x: node.x - node.size / 2 - margin,
  y: node.y - node.size / 2 - margin,
  width: node.size + margin * 2,
  height: node.size + margin * 2,
});

describe.each(WIDTHS)('map layout at %ipt', (width) => {
  it.each(SCENARIOS)('%s: everything fits and nothing overlaps', (_, currentDay, done) => {
    const layout = buildMapLayout(journeyAt(currentDay, done), width, RATIOS);
    const inside = (rect: Rect) => rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= layout.height;

    // Day 1 at the bottom, Day 90 at the top: the trail climbs.
    for (let index = 1; index < layout.nodes.length; index++) {
      expect(layout.nodes[index]!.y).toBeLessThan(layout.nodes[index - 1]!.y);
    }
    for (const node of layout.nodes) expect(inside(nodeRect(node))).toBe(true);

    // Nodes never touch each other.
    for (let index = 1; index < layout.nodes.length; index++) {
      expect(rectsOverlap(nodeRect(layout.nodes[index]!, 2), nodeRect(layout.nodes[index - 1]!, 2))).toBe(false);
    }

    // Art stays on screen and off the nodes; Milo and flags stand beside theirs.
    const art: Rect[] = [...layout.scenery, ...layout.gates, ...layout.flags];
    for (const rect of [...art, layout.milo]) expect(inside(rect)).toBe(true);
    for (const node of layout.nodes) {
      for (const rect of [...layout.scenery, ...layout.gates, ...layout.flags]) {
        expect(rectsOverlap(nodeRect(node, 2), rect)).toBe(false);
      }
      expect(rectsOverlap(nodeRect(node), layout.milo)).toBe(false);
    }
    for (const rect of [...layout.scenery, ...layout.flags]) {
      expect(rectsOverlap(rect, layout.milo)).toBe(false);
    }
  });
});

describe('Milo on any day', () => {
  it.each(WIDTHS)('stands clear of every node at %ipt, whichever day it is', (width) => {
    for (let day = 1; day <= 90; day++) {
      const layout = buildMapLayout(journeyAt(day, day - 1), width, RATIOS);
      expect(layout.milo.day).toBe(day);
      expect(layout.milo.x).toBeGreaterThanOrEqual(0);
      expect(layout.milo.x + layout.milo.width).toBeLessThanOrEqual(width);
      for (const node of layout.nodes) expect(rectsOverlap(nodeRect(node), layout.milo)).toBe(false);
    }
  });
});

describe('map layout', () => {
  it('gives every chapter but the summit its own scenery', () => {
    const layout = buildMapLayout(journeyAt(1, 0), 402, RATIOS);
    expect(layout.scenery.map((art) => art.key)).toEqual(['path', 'forest', 'river', 'mountains']);
    expect(layout.gates.map((gate) => gate.chapterId)).toEqual([
      'beginning',
      'momentum',
      'habit',
      'growth',
      'summit',
    ]);
    // A flag for every chapter end below the summit; the summit's own once it is reached.
    expect(layout.flags.map((flag) => flag.day)).toEqual([10, 30, 60, 89]);
    const done = buildMapLayout(journeyAt(90, 90), 402, RATIOS);
    expect(done.flags.map((flag) => flag.day)).toEqual([10, 30, 60, 89, 90]);
  });

  it('draws the trail solid behind today and dotted ahead', () => {
    const start = buildMapLayout(journeyAt(1, 0), 402, RATIOS);
    const end = buildMapLayout(journeyAt(90, 90), 402, RATIOS);
    const middle = buildMapLayout(journeyAt(45, 44), 402, RATIOS);
    expect(end.ahead).toHaveLength(0);
    expect(middle.walked.length).toBeGreaterThan(start.walked.length);
    expect(middle.ahead.length).toBeLessThan(start.ahead.length);
    // Everything ahead of Day 45 lies above its node.
    const day45 = middle.nodes[44]!;
    expect(middle.ahead.every((dot) => dot.y < day45.y + 1)).toBe(true);
  });

  it('keeps Milo beside today’s node — also on Day 89, one step from the summit', () => {
    const layout = buildMapLayout(journeyAt(89, 89), 402, RATIOS);
    const day89 = layout.nodes[88]!;
    const day90 = layout.nodes[89]!;
    expect(layout.milo.day).toBe(89);
    expect(Math.abs(layout.milo.y + layout.milo.height / 2 - day89.y)).toBeLessThan(40);
    // The summit is close: well within one screen above today.
    expect(day89.y - day90.y).toBeLessThan(560);
  });

  it('scrolls to show today a little below the middle, within the map', () => {
    const layout = buildMapLayout(journeyAt(89, 89), 402, RATIOS);
    const viewport = 650;
    const offset = scrollOffsetFor(layout, 89, viewport);
    const onScreen = layout.nodes[88]!.y - offset;
    expect(onScreen).toBeGreaterThan(viewport * 0.4);
    expect(onScreen).toBeLessThan(viewport * 0.7);

    const bottom = buildMapLayout(journeyAt(1, 0), 402, RATIOS);
    expect(scrollOffsetFor(bottom, 1, viewport)).toBeLessThanOrEqual(bottom.height - viewport);
    expect(scrollOffsetFor(bottom, 1, 20_000)).toBe(0);
  });
});
