import { z } from 'zod';

import { IdSchema } from './common';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';

/** A part of a sentence to pick out: the verb form, or a word that signals it. */
export const SentenceMarkSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['form', 'signal']),
});
export type SentenceMark = z.infer<typeof SentenceMarkSchema>;

/**
 * A sentence with highlighted parts. Marks are plain substrings listed in
 * reading order, so a backend can send sentences exactly as they are written.
 */
export const MarkedSentenceSchema = z
  .object({ text: z.string().min(1), marks: z.array(SentenceMarkSchema) })
  .superRefine((sentence, ctx) => {
    let from = 0;
    sentence.marks.forEach((mark, index) => {
      const at = sentence.text.indexOf(mark.text, from);
      if (at < 0) {
        ctx.addIssue({
          code: 'custom',
          message: `"${mark.text}" is not in the sentence after the previous mark`,
          path: ['marks', index],
        });
        return;
      }
      from = at + mark.text.length;
    });
  });
export type MarkedSentence = z.infer<typeof MarkedSentenceSchema>;

/** Small timelines the app can draw next to a rule: the picture of the idea. */
export const GrammarTimelineSchema = z.enum(['pastPoint', 'pastToNow', 'repeated']);
export type GrammarTimeline = z.infer<typeof GrammarTimelineSchema>;

/** One side of the rule, e.g. "Past Simple — a finished time in the past". */
export const GrammarRulePointSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** The idea in a few words. */
  idea: z.string().min(1).max(60),
  timeline: GrammarTimelineSchema.optional(),
  example: MarkedSentenceSchema,
  /** Words that usually go with it: "yesterday", "ever". */
  signals: z.array(z.string().min(1)).max(6),
});
export type GrammarRulePoint = z.infer<typeof GrammarRulePointSchema>;

/** One small grammar concept per quest: one to three points and a rule of thumb. */
export const GrammarRuleSchema = z.object({
  title: z.string().min(1),
  lead: z.string().min(1).max(120).optional(),
  points: z.array(GrammarRulePointSchema).min(1).max(3),
  tip: z.string().min(1).max(140).optional(),
});
export type GrammarRule = z.infer<typeof GrammarRuleSchema>;

/** A guided example: read the sentence, think why, then see the reason. Not scored. */
export const GrammarExampleSchema = z.object({
  id: IdSchema,
  sentence: MarkedSentenceSchema,
  /** The rule point the sentence shows. */
  pointId: IdSchema,
  /** What to think about first: "Why Past Simple?" */
  question: z.string().min(1),
  explanation: z.string().min(1).max(160),
});
export type GrammarExample = z.infer<typeof GrammarExampleSchema>;

export const ChoiceOptionSchema = z.object({ id: IdSchema, text: z.string().min(1) });
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

/** A sentence with exactly one gap, written as `___`. */
const GapSentenceSchema = z
  .string()
  .refine((sentence) => sentence.split('___').length === 2, 'needs exactly one "___" gap');

const exercise = {
  id: IdSchema,
  correctOptionId: IdSchema,
  /** Why the right answer is right: shown after every answer, one or two short sentences. */
  explanation: z.string().min(1).max(160),
};

export const GrammarExerciseSchema = z.discriminatedUnion('kind', [
  /** Two forms for one gap: "I ___ that movie three times." */
  z.object({
    kind: z.literal('choose'),
    ...exercise,
    sentence: GapSentenceSchema,
    options: z.array(ChoiceOptionSchema).length(2),
  }),
  /** Three or four options for one gap. */
  z.object({
    kind: z.literal('complete'),
    ...exercise,
    sentence: GapSentenceSchema,
    options: z.array(ChoiceOptionSchema).min(3).max(4),
  }),
  /** Whole sentences: which one is correct? */
  z.object({
    kind: z.literal('spotCorrect'),
    ...exercise,
    question: z.string().min(1),
    options: z.array(ChoiceOptionSchema).min(2).max(4),
  }),
  /** Whole sentences: which one means …? Checks understanding, not just form. */
  z.object({
    kind: z.literal('meaning'),
    ...exercise,
    question: z.string().min(1),
    options: z.array(ChoiceOptionSchema).min(2).max(4),
  }),
]);
export type GrammarExercise = z.infer<typeof GrammarExerciseSchema>;
export type GrammarExerciseKind = GrammarExercise['kind'];

/** The authored content of one Grammar quest — what a backend would send. */
export const GrammarQuestSchema = z
  .object({
    type: z.literal('grammar'),
    questId: IdSchema,
    rule: GrammarRuleSchema,
    examples: z.array(GrammarExampleSchema).min(1).max(4),
    exercises: z.array(GrammarExerciseSchema).min(1).max(10),
  })
  .superRefine((quest, ctx) => {
    const pointIds = new Set(quest.rule.points.map((point) => point.id));
    quest.examples.forEach((example, index) => {
      if (!pointIds.has(example.pointId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'pointId is not one of the rule points',
          path: ['examples', index, 'pointId'],
        });
      }
    });

    const exerciseIds = new Set<string>();
    quest.exercises.forEach((item, index) => {
      const optionIds = item.options.map((option) => option.id);
      const texts = item.options.map((option) => option.text.trim().toLowerCase());
      const problem = exerciseIds.has(item.id)
        ? 'exercise ids repeat'
        : new Set(optionIds).size !== optionIds.length
          ? 'option ids repeat'
          : new Set(texts).size !== texts.length
            ? 'options repeat'
            : !optionIds.includes(item.correctOptionId)
              ? 'correctOptionId is not one of the options'
              : null;
      exerciseIds.add(item.id);
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['exercises', index] });
    });
  });
export type GrammarQuest = z.infer<typeof GrammarQuestSchema>;

/** One locked-in practice answer. */
export const GrammarAnswerSchema = ChoiceAnswerSchema;
export type GrammarAnswer = ChoiceAnswer;

export const GrammarPhaseSchema = z.enum(['intro', 'rule', 'examples', 'practice', 'result']);
export type GrammarPhase = z.infer<typeof GrammarPhaseSchema>;

/** Where the user is inside the quest; saved with the quest session. */
export const GrammarProgressSchema = z.object({
  phase: GrammarPhaseSchema,
  /** The guided example on screen (examples phase). */
  exampleIndex: z.number().int().nonnegative(),
  /** Whether its explanation is shown. */
  exampleRevealed: z.boolean(),
  /** The exercise being answered (practice phase). */
  practiceIndex: z.number().int().nonnegative(),
  answers: z.array(GrammarAnswerSchema),
});
export type GrammarProgress = z.infer<typeof GrammarProgressSchema>;

export const GrammarResultSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  isPerfect: z.boolean(),
  ruleTitle: z.string().min(1),
});
export type GrammarResult = z.infer<typeof GrammarResultSchema>;
