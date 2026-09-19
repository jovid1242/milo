import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

import { ViewStoryButton } from './ViewStoryButton';

export type ReadingPromptProps = {
  question: string;
  /** A line from the story to set the scene. */
  snippet?: string | null;
  /** Shows the "View story" link. */
  onViewStory?: () => void;
};

/** A comprehension question — shared by the Reading and Review quests. */
export function ReadingPrompt({ question, snippet, onViewStory }: ReadingPromptProps) {
  return (
    <View style={styles.prompt}>
      {snippet ? (
        <View style={styles.snippet} accessible accessibilityLabel={`From the story: ${snippet}`}>
          <AppText variant="overline" color="tertiary">
            From the story
          </AppText>
          <AppText variant="body" color="secondary">
            {`“${snippet}”`}
          </AppText>
        </View>
      ) : null}
      <AppText variant="title2" accessibilityRole="header">
        {question}
      </AppText>
      {onViewStory ? <ViewStoryButton onPress={onViewStory} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { gap: spacing[2] },
  snippet: {
    gap: 2,
    marginBottom: spacing[2],
    paddingLeft: spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: colors.wood.light,
  },
});
