import { z } from 'zod';

import { CefrLevelSchema, IdSchema } from './common';
import { choiceProblem } from './grammar';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';

export const ReadingLevelSchema = CefrLevelSchema;
export type ReadingLevel = z.infer<typeof ReadingLevelSchema>;

export const ReadingParagraphSchema = z.object({
  id: IdSchema,
  text: z.string().min(1),
});
export type ReadingParagraph = z.infer<typeof ReadingParagraphSchema>;

/**
 * A word picked out in the story. Tapping it shows this card — an optional
 * helper, never a task. `text` is the word exactly as it appears in its paragraph.
 */
export const ReadingWordSchema = z.object({
  id: IdSchema,
  text: z.string().min(1),
  paragraphId: IdSchema,
  phonetic: z.string().optional(),
  /** Translation for the group's native language (Russian). */
  translation: z.string().min(1),
  /** A short plain-English meaning: "slowly, over time". */
  definition: z.string().min(1).max(80),
});
export type ReadingWord = z.infer<typeof ReadingWordSchema>;

export const ReadingStorySchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  level: ReadingLevelSchema,
  /** Reading time only; the quest's own estimate on Home includes the questions. */
  estimatedMinutes: z.number().int().positive(),
  paragraphs: z.array(ReadingParagraphSchema).min(2),
  words: z.array(ReadingWordSchema).max(6),
});
export type ReadingStory = z.infer<typeof ReadingStorySchema>;

/**
 * What a comprehension question checks: the main idea, a detail, something to
 * infer, or a word from its context (at most one per story).
 */
export const ReadingQuestionKindSchema = z.enum(['mainIdea', 'detail', 'inference', 'context']);
export type ReadingQuestionKind = z.infer<typeof ReadingQuestionKindSchema>;

export const ReadingQuestionSchema = z.object({
  id: IdSchema,
  kind: ReadingQuestionKindSchema,
  question: z.string().min(1),
  options: z
    .array(z.object({ id: IdSchema, text: z.string().min(1) }))
    .min(3)
    .max(4),
  correctOptionId: IdSchema,
  /** Shown after answering: where the story says it. Never shown before. */
  evidence: z.string().min(1).max(200),
  /** Context questions: the story word they ask about. */
  wordId: IdSchema.optional(),
});
export type ReadingQuestion = z.infer<typeof ReadingQuestionSchema>;

/** Finds `word` as a whole word (not inside a longer word). */
export function findWholeWord(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^\\p{L}])(${escaped})(?![\\p{L}])`, 'u').exec(text);
  return match ? match.index + (match[1]?.length ?? 0) : -1;
}

type StoryShape = {
  paragraphs: readonly { id: string; text: string }[];
  words: readonly { id: string; text: string; paragraphId: string }[];
};

/** What makes a story and its questions one consistent reading. */
function checkReading(
  reading: { story: StoryShape; questions: readonly ReadingQuestion[] },
  ctx: z.RefinementCtx,
) {
  const paragraphs = new Map(reading.story.paragraphs.map((p) => [p.id, p.text]));
  if (paragraphs.size !== reading.story.paragraphs.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'paragraph ids repeat',
      path: ['story', 'paragraphs'],
    });
  }

  const wordIds = new Set<string>();
  reading.story.words.forEach((word, index) => {
    const text = paragraphs.get(word.paragraphId);
    const problem = wordIds.has(word.id)
      ? 'word ids repeat'
      : text === undefined
        ? 'paragraphId is not one of the paragraphs'
        : findWholeWord(text, word.text) < 0
          ? `"${word.text}" is not a whole word in its paragraph`
          : null;
    wordIds.add(word.id);
    if (problem)
      ctx.addIssue({ code: 'custom', message: problem, path: ['story', 'words', index] });
  });

  const questionIds = new Set<string>();
  reading.questions.forEach((question, index) => {
    const problem = questionIds.has(question.id)
      ? 'question ids repeat'
      : (choiceProblem(question) ??
        (question.kind === 'context' && (!question.wordId || !wordIds.has(question.wordId))
          ? 'a context question needs a wordId from the story words'
          : null));
    questionIds.add(question.id);
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['questions', index] });
  });

  if (reading.questions.filter((question) => question.kind === 'context').length > 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'at most one context question: Reading checks understanding first',
      path: ['questions'],
    });
  }
}

/** One Reading quest, ready to play: the course text it reads. */
export const ReadingQuestSchema = z
  .object({
    type: z.literal('reading'),
    questId: IdSchema,
    /** The course's text this quest reads. */
    readingId: IdSchema,
    story: ReadingStorySchema,
    questions: z.array(ReadingQuestionSchema).min(3).max(5),
  })
  .superRefine(checkReading);
export type ReadingQuest = z.infer<typeof ReadingQuestSchema>;

/**
 * A highlighted word as the course stores it. A word the vocabulary bank
 * already teaches is referenced by `vocabularyId` — its meaning is read from
 * there, never copied into a second, drifting definition. A word the bank
 * does not teach (or one that means something special in this text) carries
 * its own gloss.
 */
export const ReadingGlossSchema = z
  .object({
    /** Scoped to the text; context questions refer to it. */
    id: IdSchema,
    text: z.string().min(1),
    paragraphId: IdSchema,
    vocabularyId: IdSchema.optional(),
    phonetic: z.string().optional(),
    translation: z.string().min(1).optional(),
    definition: z.string().min(1).max(80).optional(),
  })
  .refine((gloss) => gloss.vocabularyId || (gloss.translation && gloss.definition), {
    message: 'a gloss needs a vocabularyId, or its own translation and definition',
  });
export type ReadingGloss = z.infer<typeof ReadingGlossSchema>;

/**
 * A reading text of the course: the story, its highlighted words and its
 * comprehension questions — serializable data, as an API would send it.
 */
export const ReadingTextSchema = z
  .object({
    /** `reading-<slug>`. */
    id: IdSchema,
    story: ReadingStorySchema.omit({ words: true }).extend({
      words: z.array(ReadingGlossSchema).max(6),
    }),
    questions: z.array(ReadingQuestionSchema).min(3).max(5),
  })
  .superRefine(checkReading);
export type ReadingText = z.infer<typeof ReadingTextSchema>;

/** One locked-in comprehension answer. */
export const ReadingAnswerSchema = ChoiceAnswerSchema;
export type ReadingAnswer = ChoiceAnswer;

export const ReadingPhaseSchema = z.enum(['intro', 'story', 'questions', 'result']);
export type ReadingPhase = z.infer<typeof ReadingPhaseSchema>;

/** Where the reader is; saved with the quest session. */
export const ReadingProgressSchema = z.object({
  phase: ReadingPhaseSchema,
  /** The paragraph at the top of the screen (story phase) — where reading resumes. */
  paragraphIndex: z.number().int().nonnegative(),
  /** The end of the story came into view. */
  reachedEnd: z.boolean(),
  openedWordIds: z.array(IdSchema),
  /** The question being answered (questions phase). */
  practiceIndex: z.number().int().nonnegative(),
  answers: z.array(ReadingAnswerSchema),
});
export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;

export const ReadingResultSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  isPerfect: z.boolean(),
  storyTitle: z.string().min(1),
});
export type ReadingResult = z.infer<typeof ReadingResultSchema>;
