import {
  findWholeWord,
  type ReadingParagraph,
  type ReadingStory,
  type ReadingWord,
} from '@/schemas';

export type StoryPart = { text: string; wordId: string | null };

/**
 * Splits a paragraph into plain text and its looked-up words, in reading
 * order. Each word is picked out once, at its first whole-word match.
 */
export function splitParagraph(
  paragraph: ReadingParagraph,
  words: readonly ReadingWord[],
): StoryPart[] {
  const found = words
    .filter((word) => word.paragraphId === paragraph.id)
    .map((word) => ({ word, at: findWholeWord(paragraph.text, word.text) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at);

  const parts: StoryPart[] = [];
  let from = 0;
  for (const { word, at } of found) {
    if (at < from) continue; // overlapping words: keep the first
    if (at > from) parts.push({ text: paragraph.text.slice(from, at), wordId: null });
    parts.push({ text: paragraph.text.slice(at, at + word.text.length), wordId: word.id });
    from = at + word.text.length;
  }
  if (from < paragraph.text.length) parts.push({ text: paragraph.text.slice(from), wordId: null });
  return parts;
}

/**
 * A paragraph's sentences: a sentence ends at . ! ? or … (and a closing quote)
 * followed by a new sentence — a capital letter or an opening quote.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let from = 0;
  for (const match of text.matchAll(/[.!?…]+[”’"']?\s+(?=[A-Z“‘"'])/gu)) {
    const end = match.index + match[0].length;
    sentences.push(text.slice(from, end).trim());
    from = end;
  }
  const rest = text.slice(from).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

/** One sentence of the story, or `null` when the reference does not fit it. */
export function storySentence(
  story: ReadingStory,
  paragraphId: string,
  sentence: number,
): string | null {
  const paragraph = story.paragraphs.find((item) => item.id === paragraphId);
  return paragraph ? (splitSentences(paragraph.text)[sentence] ?? null) : null;
}
