import { LOCAL_COURSE } from '@/content/course';
import { indexCourse } from '@/features/course/logic/course-index';
import { resolveQuestContent } from '@/features/course/logic/resolve';
import { QuestContentSchema, type QuestContent } from '@/schemas';

const INDEX = indexCourse(LOCAL_COURSE);

/** A quest's playable content from the bundled course, as the repository serves it. */
export function questContent<T extends QuestContent['type']>(
  questId: string,
  type: T,
): Extract<QuestContent, { type: T }> {
  const content = resolveQuestContent(INDEX, questId);
  if (!content || content.type !== type) throw new Error(`No ${type} content for ${questId}`);
  return QuestContentSchema.parse(content) as Extract<QuestContent, { type: T }>;
}
