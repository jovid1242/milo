import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText, Button } from '@/components/ui';
import { QuestStage } from '@/features/quests/components/QuestStage';
import { ThinkFirstHint } from '@/features/quests/components/ThinkFirstHint';
import type { VocabularyItem } from '@/schemas';
import { colors, durations, fontFamilies, spacing } from '@/theme';

export type LearnWordProps = {
  item: VocabularyItem;
  revealed: boolean;
  onReveal: () => void;
  onLearned: () => void;
};

/**
 * One new word. The meaning stays hidden until the user has had a moment to
 * guess it — recalling first, then checking, is what makes a word stick.
 */
export function LearnWord({ item, revealed, onReveal, onLearned }: LearnWordProps) {
  return (
    <QuestStage
      footer={
        revealed ? (
          <Button label="Got it" onPress={onLearned} fullWidth testID="vocabulary-got-it" />
        ) : (
          <Button
            label="Show meaning"
            variant="secondary"
            onPress={onReveal}
            fullWidth
            testID="vocabulary-reveal"
          />
        )
      }>
      <Animated.View key={item.id} entering={FadeIn.duration(durations.normal)} style={styles.word}>
        <AppText variant="overline" color="wood">
          {`New word · ${item.partOfSpeech}`}
        </AppText>
        <AppText variant="displayLarge" accessibilityRole="header">
          {item.word}
        </AppText>
        {item.phonetic ? (
          <AppText
            variant="bodyLarge"
            color="secondary"
            accessibilityLabel={`Pronounced ${item.phonetic}`}>
            {item.phonetic}
          </AppText>
        ) : null}
      </Animated.View>

      {revealed ? (
        <Animated.View entering={FadeInDown.duration(durations.normal)} style={styles.meaning}>
          <AppText variant="headline" color="brand">
            {item.translation}
          </AppText>
          <AppText variant="bodyLarge">{item.definition}</AppText>
          <View style={styles.example}>
            <AppText variant="overline" color="tertiary">
              Example
            </AppText>
            <Example sentence={item.example} word={item.word} />
          </View>
        </Animated.View>
      ) : (
        <ThinkFirstHint
          key={`hint-${item.id}`}
          title="Do you know it?"
          message="Think of the meaning, then tap to check."
          accessibilityLabel="Show the meaning"
          onReveal={onReveal}
        />
      )}
    </QuestStage>
  );
}

/** The example sentence with the new word picked out. */
function Example({ sentence, word }: { sentence: string; word: string }) {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return <AppText variant="bodyLarge">{sentence}</AppText>;
  return (
    <AppText variant="bodyLarge">
      {sentence.slice(0, at)}
      <AppText variant="bodyLarge" color="brand" style={styles.highlight}>
        {sentence.slice(at, at + word.length)}
      </AppText>
      {sentence.slice(at + word.length)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  word: { gap: spacing[1] },
  meaning: { gap: spacing[3] },
  example: {
    gap: spacing[1],
    marginTop: spacing[2],
    paddingLeft: spacing[4],
    borderLeftWidth: 3,
    borderLeftColor: colors.wood.light,
  },
  highlight: { fontFamily: fontFamilies.semiBold },
});
