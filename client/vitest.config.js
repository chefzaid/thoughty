import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                'src/main.jsx',
                '*.config.js'
            ],
            thresholds: {
                global: {
                    branches: 80,
                    functions: 70,
                    lines: 80,
                    statements: 80
                }
            }
        }
    }
});
