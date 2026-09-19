import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import type { ReadingParagraph, ReadingWord } from '@/schemas';
import { colors, fontFamilies } from '@/theme';

import { splitParagraph } from '../logic/story-text';

export type StoryParagraphProps = {
  paragraph: ReadingParagraph;
  words: readonly ReadingWord[];
  /** Omit to show the words picked out but not tappable. */
  onOpenWord?: (wordId: string) => void;
};

/**
 * One paragraph of the story. Looked-up words stay part of the sentence —
 * a screen reader reads the paragraph as one text, with the words as links.
 */
export function StoryParagraph({ paragraph, words, onOpenWord }: StoryParagraphProps) {
  return (
    <AppText variant="reading">
      {splitParagraph(paragraph, words).map((part, index) => {
        const wordId = part.wordId;
        if (wordId === null) return part.text;
        return (
          <AppText
            key={index}
            variant="reading"
            color="wood"
            style={styles.word}
            onPress={onOpenWord ? () => onOpenWord(wordId) : undefined}
            accessibilityRole={onOpenWord ? 'link' : undefined}
            accessibilityHint={onOpenWord ? 'Shows what this word means' : undefined}>
            {part.text}
          </AppText>
        );
      })}
    </AppText>
  );
}

const styles = StyleSheet.create({
  word: {
    fontFamily: fontFamilies.medium,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: colors.wood.base,
  },
});
