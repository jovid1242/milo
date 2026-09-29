// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // The API lints itself (server/eslint.config.mjs).
    ignores: ['dist/*', 'server/*'],
  },
]);
