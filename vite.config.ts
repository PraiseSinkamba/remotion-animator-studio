import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Cross-origin isolation is required for the OPFS VFS in a worker. The dev
 * server and `vite preview` send these headers; any host that serves the
 * built app has to send them too.
 */
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: {
    headers: ISOLATION_HEADERS,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
  preview: {
    headers: ISOLATION_HEADERS,
  },
  worker: {
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    // Node by default; DOM tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
