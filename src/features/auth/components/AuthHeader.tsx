import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { durations, spacing } from '@/theme';

/** Milo and a line or two above the sign-in and sign-up forms. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(durations.normal)} style={styles.header}>
      <AssetImage asset={mascots.idle} width={132} />
      <View style={styles.text}>
        <AppText variant="title1" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {subtitle}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing[4] },
  text: { alignItems: 'center', gap: spacing[2] },
});
