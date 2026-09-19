import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, palette, radius } from '@/theme';

import { AppText } from './AppText';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  name: string;
  /** A remote picture (a future backend); initials until one exists. */
  uri?: string | null;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 44, lg: 64, xl: 88 };

/** Deterministic warm tints, so a person keeps the same color everywhere. */
const TINTS = [
  palette.forest100,
  palette.cream200,
  palette.gold100,
  palette.wood200,
  palette.forest50,
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (
    parts
      .map((part) => [...part][0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

function tintFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index++)
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return TINTS[hash % TINTS.length] ?? palette.cream200;
}

export function Avatar({ name, uri, size = 'md', style }: AvatarProps) {
  const dimension = SIZES[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.avatar,
        { width: dimension, height: dimension, backgroundColor: tintFor(name) },
        style,
      ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppText
          variant={
            size === 'xl'
              ? 'title1'
              : size === 'lg'
                ? 'title2'
                : size === 'xs'
                  ? 'caption'
                  : 'label'
          }
          color="brand"
          maxFontSizeMultiplier={1.2}>
          {initials(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
});
