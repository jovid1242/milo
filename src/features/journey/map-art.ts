import { chapters, journey, mascots } from '@/constants/assets';

import type { MapArtRatios } from './logic/map-layout';

const ratio = (asset: { width: number; height: number }) => asset.height / asset.width;

/** The art the map is composed from; the layout only needs its proportions. */
export const MAP_ART_RATIOS: MapArtRatios = {
  camp: ratio(journey.camp),
  campfire: ratio(journey.campfire),
  summit: ratio(journey.summit),
  gate: ratio(chapters.beginning),
  milo: ratio(mascots.walking),
  flag: ratio(journey.flagNormal),
  scenery: {
    path: ratio(journey.path),
    forest: ratio(journey.forest),
    river: ratio(journey.river),
    mountains: ratio(journey.mountains),
  },
};

export const SCENERY_ART = {
  path: journey.path,
  forest: journey.forest,
  river: journey.river,
  mountains: journey.mountains,
} as const;
