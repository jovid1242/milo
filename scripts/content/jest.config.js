/**
 * Runs scripts/content/validate-course.ts with the app's own Jest setup and
 * prints only its report (see reporter.js). Exits non-zero on any error.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  ...require('../../jest.config.js'),
  rootDir: '../..',
  roots: ['<rootDir>/scripts/content'],
  testMatch: ['<rootDir>/scripts/content/validate-course.ts'],
  reporters: ['<rootDir>/scripts/content/reporter.js'],
  // Buffered console output goes to the reporter, not straight to the terminal.
  verbose: false,
};
