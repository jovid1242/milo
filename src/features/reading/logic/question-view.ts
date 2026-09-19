import type { ReadingQuestion, ReadingQuestionKind } from '@/schemas';

const INSTRUCTIONS: Record<ReadingQuestionKind, string> = {
  mainIdea: 'The big picture',
  detail: 'A detail',
  inference: 'Read between the lines',
  context: 'A word in context',
};

/**
 * What a comprehension question shows. The evidence from the story only
 * appears once the question is answered — right or wrong.
 */
export function describeReadingQuestion(question: ReadingQuestion) {
  return {
    instruction: INSTRUCTIONS[question.kind],
    options: question.options.map((option) => ({ id: option.id, label: option.text })),
    feedback: { correct: question.evidence, wrong: question.evidence },
  };
}
