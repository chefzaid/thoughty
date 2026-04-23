import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'charts';
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('unist')
          ) {
            return 'markdown';
          }

          if (id.includes('react-datepicker') || id.includes('date-fns')) {
            return 'datepicker';
          }

          if (id.includes('@uiw/react-md-editor')) {
            return 'editor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Silently ignore proxy errors (server not ready yet)
          });
        },
      },
    },
  },
});
