import { LOCAL_COURSE } from '@/content/course';

import { LEGACY_WORD_IDS, MIGRATIONS, courseWordId, renameWordIdsInJson } from '../migrations';

describe('migrations', () => {
  it('are numbered 1…n, in order, each once', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
    expect(MIGRATIONS.at(-1)?.name).toBe('course cache');
  });
});

describe('course-wide word ids (migration 10)', () => {
  it('renames the words stored before the id convention, and nothing else', () => {
    expect(courseWordId('journey')).toBe('vocab-journey');
    expect(courseWordId('overcome')).toBe('vocab-overcome');
    for (const untouched of ['vocab-journey', 'routine', 'a', 'd001-vocabulary', '']) {
      expect(courseWordId(untouched)).toBe(untouched);
    }
  });

  it('lands every renamed word on a word of the course', () => {
    const bank = new Set(LOCAL_COURSE.vocabulary.map((word) => word.id));
    expect(LEGACY_WORD_IDS.size).toBe(12);
    for (const id of LEGACY_WORD_IDS) expect(bank.has(courseWordId(id))).toBe(true);
  });

  it('renames the words a saved Vocabulary quest has shown and the words answers picked', () => {
    const session = JSON.stringify({
      phase: 'practice',
      learnedItemIds: ['journey', 'habit'],
      answers: [
        { exerciseId: 'd001-vocab-1', optionId: 'goal', correct: false },
        { exerciseId: 'd001-vocab-2', optionId: 'journey', correct: true },
      ],
    });
    expect(JSON.parse(renameWordIdsInJson(session))).toEqual({
      phase: 'practice',
      learnedItemIds: ['vocab-journey', 'vocab-habit'],
      answers: [
        { exerciseId: 'd001-vocab-1', optionId: 'vocab-goal', correct: false },
        { exerciseId: 'd001-vocab-2', optionId: 'vocab-journey', correct: true },
      ],
    });
  });

  it('leaves grammar, reading and exam answers — options a…d — as they are', () => {
    const answer = JSON.stringify({ exerciseId: 'g1', optionId: 'b', correct: true });
    expect(renameWordIdsInJson(answer)).toBe(answer);
    const exam = JSON.stringify({ answers: [{ questionId: 'w12-v1', optionId: 'c' }] });
    expect(renameWordIdsInJson(exam)).toBe(exam);
  });

  it('is safe to run twice and on anything stored', () => {
    const once = renameWordIdsInJson(JSON.stringify({ learnedItemIds: ['goal'] }));
    expect(renameWordIdsInJson(once)).toBe(once);
    for (const stored of ['null', '42', '"journey"', 'not json', '{"optionId":7}']) {
      expect(renameWordIdsInJson(stored)).toBe(stored);
    }
  });
});
