import { Image, type ImageContentFit } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

import type { ImageAsset } from '@/constants/assets';

export type AssetImageProps = {
  asset: ImageAsset;
  /** Rendered width in points; height follows the asset's intrinsic ratio. */
  width: number;
  /** Omit for decorative art — it is then hidden from screen readers. */
  accessibilityLabel?: string;
  contentFit?: ImageContentFit;
  /** Cross-fade duration (ms) when `asset` changes, e.g. Milo switching pose. */
  transition?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Draws an asset from the generated registry at the right aspect ratio, so no
 * screen has to hardcode image dimensions.
 */
export function AssetImage({
  asset,
  width,
  accessibilityLabel,
  contentFit = 'contain',
  transition,
  style,
}: AssetImageProps) {
  const height = Math.round((width * asset.height) / asset.width);
  const decorative = accessibilityLabel === undefined;

  return (
    <Image
      source={asset.source}
      contentFit={contentFit}
      transition={transition}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[{ width, height }, style]}
    />
  );
}
