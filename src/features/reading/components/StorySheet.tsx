import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import type { ReadingStory } from '@/schemas';
import { colors, layout, spacing } from '@/theme';

import { StoryParagraph } from './StoryParagraph';

export type StorySheetProps = {
  story: ReadingStory;
  visible: boolean;
  onClose: () => void;
};

/**
 * The story again, over the question — nobody has to remember 400 words.
 * Closing it (button or swipe down) returns to the same question.
 */
export function StorySheet({ story, visible, onClose }: StorySheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.bar}>
          <AppText variant="overline" color="wood">
            The story
          </AppText>
          <Button label="Back to the question" size="sm" variant="secondary" onPress={onClose} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, spacing[6]) + spacing[6] },
          ]}>
          <AppText variant="title1" accessibilityRole="header">
            {story.title}
          </AppText>
          {story.paragraphs.map((paragraph) => (
            <StoryParagraph key={paragraph.id} paragraph={paragraph} words={story.words} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background.warm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.warm,
  },
  content: {
    gap: spacing[5],
    paddingTop: spacing[5],
    paddingHorizontal: layout.screenPaddingX,
  },
});
