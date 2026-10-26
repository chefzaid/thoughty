import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // Messages go through the app's notice toast or an inline error, confirmations through ConfirmModal
      'no-alert': 'error',
    },
  },
  {
    files: ['src/**/*.test-helpers.tsx'],
    // Shared spec setup: test stand-in components sit beside fixtures, and Fast Refresh never loads these files.
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      // Playwright fixtures call `use`, which is not React's hook.
      'react-hooks/rules-of-hooks': 'off',
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@playwright/test',
          importNames: ['test'],
          message: "Import test from e2e/support/test: its fixture keeps every /api request inside the browser.",
        }],
      }],
    },
  },
  {
    files: ['e2e/support/test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
