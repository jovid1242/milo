import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ReadingStory } from '@/schemas';
import { spacing } from '@/theme';

/** The keepsake of a Reading quest: the story you read. */
export function StoryRead({ story }: { story: ReadingStory }) {
  return (
    <View style={styles.block} accessible accessibilityLabel={`Story read: ${story.title}`}>
      <AppText variant="overline" color="tertiary" align="center">
        Story read
      </AppText>
      <AppText variant="title2" align="center">
        {story.title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[1] },
});
