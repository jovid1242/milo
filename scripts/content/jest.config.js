/**
 * Runs the content scripts in this folder with the app's own Jest setup and
 * prints only their output (see reporter.js): validate-course.ts
 * (`npm run content:validate`, non-zero exit on any error) and
 * curriculum-doc.ts (`npm run curriculum:doc`).
 *
 * @type {import('jest').Config}
 */
module.exports = {
  ...require('../../jest.config.js'),
  rootDir: '../..',
  roots: ['<rootDir>/scripts/content'],
  // One entry per command; package.json picks one by name.
  testMatch: ['<rootDir>/scripts/content/*.ts'],
  reporters: ['<rootDir>/scripts/content/reporter.js'],
  // Buffered console output goes to the reporter, not straight to the terminal.
  verbose: false,
};
