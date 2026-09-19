import { z } from 'zod';

import { IdSchema } from './common';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';

export const ReadingLevelSchema = z.enum(['A2', 'B1', 'B2']);
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

/** The authored content of one Reading quest — what a backend would send. */
export const ReadingQuestSchema = z
  .object({
    type: z.literal('reading'),
    questId: IdSchema,
    story: ReadingStorySchema,
    questions: z.array(ReadingQuestionSchema).min(3).max(5),
  })
  .superRefine((quest, ctx) => {
    const paragraphs = new Map(quest.story.paragraphs.map((p) => [p.id, p.text]));
    if (paragraphs.size !== quest.story.paragraphs.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'paragraph ids repeat',
        path: ['story', 'paragraphs'],
      });
    }

    const wordIds = new Set<string>();
    quest.story.words.forEach((word, index) => {
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
    quest.questions.forEach((question, index) => {
      const optionIds = question.options.map((option) => option.id);
      const texts = question.options.map((option) => option.text.trim().toLowerCase());
      const problem = questionIds.has(question.id)
        ? 'question ids repeat'
        : new Set(optionIds).size !== optionIds.length
          ? 'option ids repeat'
          : new Set(texts).size !== texts.length
            ? 'options repeat'
            : !optionIds.includes(question.correctOptionId)
              ? 'correctOptionId is not one of the options'
              : question.kind === 'context' && (!question.wordId || !wordIds.has(question.wordId))
                ? 'a context question needs a wordId from the story words'
                : null;
      questionIds.add(question.id);
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['questions', index] });
    });

    if (quest.questions.filter((question) => question.kind === 'context').length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'at most one context question: Reading checks understanding first',
        path: ['questions'],
      });
    }
  });
export type ReadingQuest = z.infer<typeof ReadingQuestSchema>;

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
