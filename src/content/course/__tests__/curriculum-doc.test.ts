import { LOCAL_COURSE } from '@/content/course';
import {
  renderCurriculumSections,
  updateGeneratedSections,
} from '@/features/course/logic/curriculum-doc';

// Jest runs this file in Node; the app's tsconfig carries no Node types.
declare const require: (id: 'fs' | 'path') => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const DOC = join(__dirname, '../../../../docs/CURRICULUM_90_DAY.md');

describe('docs/CURRICULUM_90_DAY.md', () => {
  it('shows the curriculum as it is (run `npm run curriculum:doc` after changing it)', () => {
    const doc = readFileSync(DOC, 'utf8');
    expect(updateGeneratedSections(doc, renderCurriculumSections(LOCAL_COURSE))).toBe(doc);
  });

  it('refuses a document without its generated blocks', () => {
    expect(() =>
      updateGeneratedSections('# Curriculum', renderCurriculumSections(LOCAL_COURSE)),
    ).toThrow('<!-- curriculum:bands -->');
  });
});
