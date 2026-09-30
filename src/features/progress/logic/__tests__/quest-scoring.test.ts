import { LOCAL_COURSE } from '@/content/course';
import { CourseReader, validatedCourse } from '@/data/repositories/course/course-reader';
import { asChoice as grammarChoice } from '@/features/grammar/logic/grammar-session';
import { asChoice as readingChoice } from '@/features/reading/logic/reading-session';
import { resolveReview } from '@/features/review/logic/review-items';
import { asChoice as vocabularyChoice } from '@/features/vocabulary/logic/vocabulary-session';
import type { QuestContent } from '@/schemas';

import {
  questReward,
  scorableExercises,
  scoreQuestAnswers,
  type ScorableExercise,
} from '../quest-scoring';

const reader = new CourseReader(validatedCourse(LOCAL_COURSE));
const contents = reader
  .days()
  .flatMap((day) => day.quests)
  .map((quest) => reader.questContent(quest.id))
  .filter((content): content is QuestContent => content !== null);

/** What each quest screen actually plays — the screens' own code. */
function played(content: QuestContent): ScorableExercise[] | null {
  switch (content.type) {
    case 'vocabulary':
      return content.exercises.map(vocabularyChoice);
    case 'grammar':
      return content.exercises.map(grammarChoice);
    case 'reading':
      return content.questions.map(readingChoice);
    case 'review':
      return resolveReview(content).map((item) => item.choice);
    default:
      return null;
  }
}

describe('what the server scores', () => {
  it('is exactly what every quest screen plays, for every quest of the course', () => {
    expect(contents.length).toBeGreaterThan(10);
    for (const content of contents) {
      expect({ quest: content.questId, exercises: scorableExercises(content) }).toEqual({
        quest: content.questId,
        exercises: played(content),
      });
    }
  });
});

describe('scoring a played quest', () => {
  const exercises: ScorableExercise[] = [
    { id: 'e1', correctOptionId: 'a', optionIds: ['a', 'b'] },
    { id: 'e2', correctOptionId: 'b', optionIds: ['a', 'b'] },
  ];

  it('counts right answers from the options chosen, never from a claimed result', () => {
    expect(
      scoreQuestAnswers(exercises, [
        { exerciseId: 'e1', optionId: 'a' },
        { exerciseId: 'e2', optionId: 'a' },
      ]),
    ).toEqual({ correctCount: 1, totalCount: 2, score: 0.5, isPerfect: false });
  });

  it('refuses anything a quest screen could not have sent', () => {
    const right = [
      { exerciseId: 'e1', optionId: 'a' },
      { exerciseId: 'e2', optionId: 'b' },
    ];
    expect(scoreQuestAnswers(exercises, right)).toMatchObject({ isPerfect: true });
    expect(scoreQuestAnswers(exercises, right.slice(1))).toBeNull();
    expect(scoreQuestAnswers(exercises, [right[0]!, right[0]!])).toBeNull();
    expect(
      scoreQuestAnswers(exercises, [right[0]!, { exerciseId: 'e2', optionId: 'z' }]),
    ).toBeNull();
    expect(
      scoreQuestAnswers(exercises, [right[0]!, { exerciseId: 'e9', optionId: 'a' }]),
    ).toBeNull();
  });

  it('pays the quest’s reward and the perfect bonus — a weekly exam pays through its pass', () => {
    expect(questReward({ type: 'vocabulary', xpReward: 20 }, true)).toBe(30);
    expect(questReward({ type: 'vocabulary', xpReward: 20 }, false)).toBe(20);
    expect(questReward({ type: 'weeklyExam', xpReward: 100 }, true)).toBe(0);
  });
});
