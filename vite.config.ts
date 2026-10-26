import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Cross-origin isolation for the OPFS VFS in a worker. The dev server and
 * `vite preview` send these headers; any host that serves the built app has
 * to send them too.
 *
 * `credentialless` rather than `require-corp`: the editor can hold media from
 * another origin, and `require-corp` blocks those unless the other server
 * opts in. `credentialless` keeps the page isolated and still loads them.
 */
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
