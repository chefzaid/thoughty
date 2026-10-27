import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const MIGRATION_IMPORTS =
  'Migrations import only typeorm, node: built-ins and files under src/database/migrations; freeze the logic a migration needs next to it.';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // A migration must do the same on every database whenever it runs, so it may not load application
    // code that later changes: only TypeORM, Node built-ins and files inside the migrations folder
    // (src/database/migrations-isolation.spec.ts checks every file, nested or not, and dynamic imports).
    files: ['src/database/migrations/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!typeorm$|node:|\\./)', message: MIGRATION_IMPORTS }] }],
    },
  },
  {
    files: ['src/database/migrations/*/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!typeorm$|node:|\\.\\.?/)|^\\.\\./\\.\\./', message: MIGRATION_IMPORTS }] }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
]);