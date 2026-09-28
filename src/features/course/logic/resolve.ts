import type {
  QuestContent,
  ReadingStory,
  ReadingText,
  ReviewExercise,
  ReviewMaterial,
  VocabularyItem,
} from '@/schemas';

import type { CourseIndex } from './course-index';

/**
 * Turns the normalized course into what gameplay plays: each quest's content
 * with its references filled in from the banks — the same models whether the
 * course came bundled or from an API.
 */

/** A text's highlighted words, meanings filled in from the vocabulary bank where referenced. */
export function resolveStory(
  text: ReadingText,
  words: ReadonlyMap<string, VocabularyItem>,
): ReadingStory {
  return {
    ...text.story,
    words: text.story.words.map((gloss) => {
      const word = gloss.vocabularyId ? words.get(gloss.vocabularyId) : undefined;
      const translation = gloss.translation ?? word?.translation;
      const definition = gloss.definition ?? word?.definition;
      if (!translation || !definition) {
        throw new Error(`${text.id}: highlighted word "${gloss.text}" has no meaning to show`);
      }
      const phonetic = gloss.phonetic ?? word?.phonetic;
      return {
        id: gloss.id,
        text: gloss.text,
        paragraphId: gloss.paragraphId,
        ...(phonetic ? { phonetic } : {}),
        translation,
        definition,
      };
    }),
  };
}

function reviewMaterial(
  exercises: readonly ReviewExercise[],
  index: CourseIndex,
  questId: string,
): ReviewMaterial {
  const wordIds = new Set<string>();
  const pointIds = new Set<string>();
  const readingIds = new Set<string>();
  for (const item of exercises) {
    if (item.source === 'vocabulary') {
      [item.exercise.itemId, ...item.exercise.optionItemIds].forEach((id) => wordIds.add(id));
    } else if (item.source === 'grammar') {
      pointIds.add(item.pointId);
    } else {
      readingIds.add(item.readingId);
    }
  }
  const missing = (kind: string, id: string): never => {
    throw new Error(`${questId}: unknown ${kind} "${id}"`);
  };
  return {
    words: [...wordIds].map((id) => index.words.get(id) ?? missing('word', id)),
    points: [...pointIds].map((id) => index.points.get(id)?.point ?? missing('grammar point', id)),
    readings: [...readingIds].map((id) => {
      const text = index.readings.get(id) ?? missing('reading', id);
      return { id, story: resolveStory(text, index.words) };
    }),
  };
}

/**
 * A quest's playable content, or `null` while the course has none for it yet.
 * Throws only for a course that references something it does not contain —
 * which `validateCourse` rules out before a course is ever used.
 */
export function resolveQuestContent(index: CourseIndex, questId: string): QuestContent | null {
  const exam = index.exams.get(questId);
  if (exam) return exam;

  const definition = index.definitions.get(questId);
  if (!definition) return null;
  const missing = (kind: string, id: string): never => {
    throw new Error(`${questId}: unknown ${kind} "${id}"`);
  };

  switch (definition.type) {
    case 'vocabulary':
      return {
        type: 'vocabulary',
        questId,
        items: definition.wordIds.map((id) => index.words.get(id) ?? missing('word', id)),
        exercises: definition.exercises,
      };
    case 'grammar': {
      const lesson =
        index.lessons.get(definition.lessonId) ?? missing('grammar lesson', definition.lessonId);
      return {
        type: 'grammar',
        questId,
        lessonId: lesson.id,
        rule: lesson.rule,
        examples: lesson.examples,
        exercises: lesson.exercises,
      };
    }
    case 'reading': {
      const text =
        index.readings.get(definition.readingId) ?? missing('reading', definition.readingId);
      return {
        type: 'reading',
        questId,
        readingId: text.id,
        story: resolveStory(text, index.words),
        questions: text.questions,
      };
    }
    case 'review':
      return {
        type: 'review',
        questId,
        exercises: definition.exercises,
        material: reviewMaterial(definition.exercises, index, questId),
      };
  }
}
