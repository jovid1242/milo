import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText, Button, PressableScale } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { QuestStage } from '@/features/quests/components/QuestStage';
import type { VocabularyItem } from '@/schemas';
import { colors, durations, fontFamilies, radius, spacing } from '@/theme';

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
        <Animated.View
          key={`hint-${item.id}`}
          entering={FadeIn.duration(durations.normal).delay(80)}>
          <PressableScale
            onPress={onReveal}
            accessibilityRole="button"
            accessibilityLabel="Show the meaning"
            accessibilityHint="Think of what the word means first"
            style={styles.hint}>
            <AssetImage asset={mascots.thinking} width={72} />
            <View style={styles.hintText}>
              <AppText variant="bodyStrong">Do you know it?</AppText>
              <AppText variant="caption" color="secondary">
                Think of the meaning, then tap to check.
              </AppText>
            </View>
          </PressableScale>
        </Animated.View>
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border.warm,
    backgroundColor: colors.surface.warm,
  },
  hintText: { flex: 1, gap: 2 },
});
