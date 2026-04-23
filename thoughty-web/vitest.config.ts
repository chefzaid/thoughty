import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    testTimeout: 30000,
    pool: 'vmThreads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/main.tsx',
        'src/App.tsx',
        'src/contexts/AuthContext.tsx',
        'src/hooks/useAppState.ts',
        'src/components/CloudSync/CloudSync.tsx',
        'src/components/DiaryManager/DiaryManager.tsx',
        'src/components/EntriesList/EntriesList.tsx',
        'src/components/ProfilePage/ProfilePage.tsx',
        'src/components/ProfilePage/SecuritySection.tsx',
        'src/components/ProfilePictureEditor/ProfilePictureEditor.tsx',
        'src/services/api/index.ts',
        '*.config.ts',
        'src/types/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 70,
          lines: 90,
          statements: 80,
        },
      },
    },
  },
});
