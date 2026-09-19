import { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, Button } from '@/components/ui';
import type { ReadingStory } from '@/schemas';
import { colors, durations, spacing } from '@/theme';

import { StoryParagraph } from './StoryParagraph';

export type StoryReaderProps = {
  story: ReadingStory;
  /** Where reading resumes: that paragraph is scrolled to the top once. */
  initialParagraph: number;
  onOpenWord: (wordId: string) => void;
  /** The paragraph at the top when scrolling settles — saved, not every pixel. */
  onReadTo: (paragraphIndex: number) => void;
  onReachEnd: () => void;
  onFinish: () => void;
};

/** How far into the viewport the end mark must come before the story counts as read. */
const END_MARGIN = 24;

/**
 * The story, and nothing else: title, text, and at the very end the way on to
 * the questions — reachable by reading (or by VoiceOver) to the end, never locked.
 */
export function StoryReader({
  story,
  initialParagraph,
  onOpenWord,
  onReadTo,
  onReachEnd,
  onFinish,
}: StoryReaderProps) {
  const scrollRef = useRef<ScrollView>(null);
  const paragraphY = useRef<number[]>([]);
  const endY = useRef<number | null>(null);
  const viewport = useRef(0);
  const scrollY = useRef(0);
  const reached = useRef(false);
  const restored = useRef(initialParagraph === 0);

  const checkEnd = () => {
    if (reached.current || endY.current === null || viewport.current === 0) return;
    if (scrollY.current + viewport.current >= endY.current + END_MARGIN) {
      reached.current = true;
      onReachEnd();
    }
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    let top = 0;
    paragraphY.current.forEach((start, index) => {
      if (start <= y + spacing[6]) top = index;
    });
    onReadTo(top);
  };

  return (
    <Animated.View entering={FadeIn.duration(durations.slow)} style={styles.fill}>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.content}
        scrollEventThrottle={100}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          checkEnd();
        }}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          checkEnd();
        }}
        onScrollEndDrag={settle}
        onMomentumScrollEnd={settle}>
        <View style={styles.header}>
          <AppText variant="overline" color="wood">
            {`${story.level} · ${story.estimatedMinutes} min read`}
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            {story.title}
          </AppText>
          {story.subtitle ? (
            <AppText variant="bodyLarge" color="secondary">
              {story.subtitle}
            </AppText>
          ) : null}
        </View>

        {story.paragraphs.map((paragraph, index) => (
          <View
            key={paragraph.id}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              paragraphY.current[index] = y;
              if (!restored.current && index === initialParagraph) {
                restored.current = true;
                scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[4]), animated: false });
              }
            }}>
            <StoryParagraph paragraph={paragraph} words={story.words} onOpenWord={onOpenWord} />
          </View>
        ))}

        <View
          style={styles.end}
          onLayout={(event) => {
            endY.current = event.nativeEvent.layout.y;
            checkEnd();
          }}>
          <View style={styles.ornament} accessibilityElementsHidden importantForAccessibility="no">
            {[0, 1, 2].map((dot) => (
              <View key={dot} style={styles.dot} />
            ))}
          </View>
          <Button
            label="Continue to questions"
            onPress={onFinish}
            fullWidth
            testID="reading-finish"
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const DOT = 5;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: spacing[8], paddingBottom: spacing[6], gap: spacing[5] },
  header: { gap: spacing[1], marginBottom: spacing[3] },
  end: { gap: spacing[6], paddingTop: spacing[4] },
  ornament: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.wood.light },
});
