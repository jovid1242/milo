import type {
  Course,
  CourseDay,
  CourseOutline,
  DayNumber,
  Exam,
  GrammarLesson,
  GrammarRulePoint,
  LessonQuestDefinition,
  Quest,
  ReadingText,
  VocabularyItem,
} from '@/schemas';

/**
 * A validated course, indexed for lookups by id. Built once per course; both
 * the resolver and the validator read the course through it.
 */
export type CourseIndex = {
  course: Course;
  outline: CourseOutline;
  days: ReadonlyMap<DayNumber, CourseDay>;
  /** Every quest slot of the plan, by quest id. */
  slots: ReadonlyMap<string, Quest>;
  words: ReadonlyMap<string, VocabularyItem>;
  lessons: ReadonlyMap<string, GrammarLesson>;
  points: ReadonlyMap<string, { point: GrammarRulePoint; lessonId: string }>;
  readings: ReadonlyMap<string, ReadingText>;
  /** Daily quests' content, by quest id. */
  definitions: ReadonlyMap<string, LessonQuestDefinition>;
  /** Weekly exams and the Final Battle, by quest id. */
  exams: ReadonlyMap<string, Exam>;
};

export function indexCourse(course: Course): CourseIndex {
  const exams: Exam[] = [...course.checkpoints];
  if (course.finalChallenge) exams.push(course.finalChallenge);
  return {
    course,
    outline: {
      id: course.id,
      version: course.version,
      title: course.title,
      language: course.language,
      supportLanguage: course.supportLanguage,
      totalDays: course.totalDays,
      chapters: course.chapters,
      days: course.days,
    },
    days: new Map(course.days.map((day) => [day.day, day])),
    slots: new Map(course.days.flatMap((day) => day.quests.map((quest) => [quest.id, quest]))),
    words: new Map(course.vocabulary.map((word) => [word.id, word])),
    lessons: new Map(course.grammar.map((lesson) => [lesson.id, lesson])),
    points: new Map(
      course.grammar.flatMap((lesson) =>
        lesson.rule.points.map((point) => [point.id, { point, lessonId: lesson.id }] as const),
      ),
    ),
    readings: new Map(course.readings.map((reading) => [reading.id, reading])),
    definitions: new Map(course.lessons.map((definition) => [definition.questId, definition])),
    exams: new Map(exams.map((exam) => [exam.questId, exam])),
  };
}

/**
 * When each piece of material is first taught: a word by the Vocabulary quest
 * that lists it, a grammar lesson (and its points) by its Grammar quest, a
 * text by its Reading quest. What comes back later — in reviews, exams, the
 * Final Battle — is review, never new material.
 */
export function introductionDays(index: CourseIndex): Map<string, DayNumber> {
  const introduced = new Map<string, DayNumber>();
  const teach = (id: string, day: DayNumber) => {
    const earlier = introduced.get(id);
    if (earlier === undefined || day < earlier) introduced.set(id, day);
  };
  for (const definition of index.course.lessons) {
    const day = index.slots.get(definition.questId)?.day;
    if (day === undefined) continue;
    switch (definition.type) {
      case 'vocabulary':
        definition.wordIds.forEach((id) => teach(id, day));
        break;
      case 'grammar': {
        teach(definition.lessonId, day);
        index.lessons
          .get(definition.lessonId)
          ?.rule.points.forEach((point) => teach(point.id, day));
        break;
      }
      case 'reading':
        teach(definition.readingId, day);
        break;
      case 'review':
        break;
    }
  }
  return introduced;
}
