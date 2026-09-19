import type { MarkedSentence, SentenceMark } from '@/schemas';

export type SentencePart = { text: string; kind: SentenceMark['kind'] | 'plain' };

/** Splits a sentence into plain text and its marked parts, in reading order. */
export function splitMarks(sentence: MarkedSentence): SentencePart[] {
  const parts: SentencePart[] = [];
  let from = 0;
  for (const mark of sentence.marks) {
    const at = sentence.text.indexOf(mark.text, from);
    if (at < 0) continue;
    if (at > from) parts.push({ text: sentence.text.slice(from, at), kind: 'plain' });
    parts.push({ text: mark.text, kind: mark.kind });
    from = at + mark.text.length;
  }
  if (from < sentence.text.length) parts.push({ text: sentence.text.slice(from), kind: 'plain' });
  return parts;
}
