import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export type DividerProps = {
  /** Left inset, e.g. to align with text after an icon. */
  inset?: number;
  tone?: 'subtle' | 'warm';
  style?: StyleProp<ViewStyle>;
};

export function Divider({ inset = 0, tone = 'subtle', style }: DividerProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.divider,
        {
          marginLeft: inset,
          backgroundColor: tone === 'warm' ? colors.border.warm : colors.border.subtle,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
});
