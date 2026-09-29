/**
 * `npm run curriculum:doc` — rewrites the generated parts of
 * docs/CURRICULUM_90_DAY.md (day map, checkpoints, syllabus, stats…) from the
 * curriculum data. Run it after changing the curriculum; a test fails while
 * the document is out of date.
 */
import { LOCAL_COURSE } from '@/content/course';
import {
  renderCurriculumSections,
  updateGeneratedSections,
} from '@/features/course/logic/curriculum-doc';

// Jest runs this in Node; the app's tsconfig carries no Node types.
declare const require: (id: 'fs' | 'path') => unknown;
declare const __dirname: string;
const { readFileSync, writeFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  writeFileSync: (path: string, data: string) => void;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const DOC = join(__dirname, '../../docs/CURRICULUM_90_DAY.md');

test('curriculum document', () => {
  const doc = readFileSync(DOC, 'utf8');
  const next = updateGeneratedSections(doc, renderCurriculumSections(LOCAL_COURSE));
  if (next !== doc) writeFileSync(DOC, next);
  console.log(
    next === doc
      ? 'docs/CURRICULUM_90_DAY.md is up to date.'
      : 'Updated docs/CURRICULUM_90_DAY.md.',
  );
});
