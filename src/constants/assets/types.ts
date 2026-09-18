import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

/** Review status carried over from ASSET_MANIFEST.md. */
export type AssetReviewStatus =
  | 'READY'
  | 'VISUAL_REVIEW_REQUIRED'
  | 'NEEDS_ALPHA_REVIEW'
  | 'AUDIO_REVIEW_REQUIRED'
  | 'DUPLICATE_REVIEW_REQUIRED';

export type ImageAsset = {
  readonly kind: 'image';
  /** Metro asset id — pass to expo-image `source`. */
  readonly source: number;
  /** Intrinsic pixel size, for aspect ratios without measuring. */
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly status: AssetReviewStatus;
};

export type VectorAsset = {
  readonly kind: 'vector';
  readonly Component: FC<SvgProps>;
  readonly width: number;
  readonly height: number;
  readonly status: AssetReviewStatus;
};

export type SoundAsset = {
  readonly kind: 'sound';
  readonly source: number;
  readonly durationMs: number;
  readonly status: AssetReviewStatus;
};

export type MissingAsset = {
  readonly category: string;
  readonly expected: string;
};
