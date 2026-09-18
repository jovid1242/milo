import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { House, Map, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, layout, radius, spacing } from '@/theme';

const ICONS: Record<string, LucideIcon> = {
  index: House,
  journey: Map,
  friends: Users,
  profile: UserRound,
};

/**
 * Brand tab bar (design-system `navigation`): white, hairline top border,
 * forest accent for the active tab. A custom bar keeps the same look on both
 * platforms, which the iOS 26 system tab bar would not.
 */
export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;
        const isFocused = state.index === index;
        const Icon = ICONS[route.name] ?? House;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
            testID={`tab-${route.name}`}
            hitSlop={8}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (isFocused || event.defaultPrevented) return;
              triggerHaptic('selection');
              navigation.navigate(route.name, route.params);
            }}>
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Icon
                size={22}
                strokeWidth={isFocused ? 2.4 : 2}
                color={isFocused ? colors.brand.deep : colors.text.tertiary}
              />
            </View>
            <AppText variant="caption" color={isFocused ? 'primary' : 'tertiary'}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[2],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
    minHeight: layout.minTouchTarget,
  },
  iconWrap: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  iconWrapActive: { backgroundColor: colors.brand.tint },
});
