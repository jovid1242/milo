import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import type { MarkedSentence } from '@/schemas';
import { colors, type TypographyVariant } from '@/theme';

import { splitMarks } from '../logic/marked-sentence';

export type MarkedTextProps = {
  sentence: MarkedSentence;
  variant?: TypographyVariant;
  /** Off before an example is explained: the sentence is read plain first. */
  showMarks?: boolean;
  align?: 'left' | 'center';
};

/**
 * A sentence with its grammar picked out: the verb form in forest green, the
 * words that signal it in wood brown and underlined.
 */
export function MarkedText({
  sentence,
  variant = 'speech',
  showMarks = true,
  align = 'left',
}: MarkedTextProps) {
  return (
    <AppText variant={variant} align={align}>
      {splitMarks(sentence).map((part, index) =>
        part.kind === 'plain' || !showMarks ? (
          part.text
        ) : (
          <AppText
            key={index}
            variant={variant}
            color={part.kind === 'form' ? 'brand' : 'wood'}
            style={part.kind === 'signal' ? styles.signal : null}>
            {part.text}
          </AppText>
        ),
      )}
    </AppText>
  );
}

const styles = StyleSheet.create({
  signal: { textDecorationLine: 'underline', textDecorationColor: colors.wood.light },
});
