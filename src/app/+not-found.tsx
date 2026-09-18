import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, Screen } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { spacing } from '@/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.content}>
        <AssetImage asset={mascots.thinking} width={180} />
        <AppText variant="title2" align="center">
          This path is not on the map
        </AppText>
        <Button label="Back to today" onPress={() => router.replace('/')} size="md" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[5] },
});
