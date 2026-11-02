import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    conditions: ['development', 'module', 'browser', 'import', 'default'],
    alias: {
      '@testing-library/react': resolve('apps/studio/node_modules/@testing-library/react'),
      react: resolve('apps/studio/node_modules/react'),
      '@remotion/player': resolve('apps/studio/node_modules/@remotion/player'),
    },
  },
  test: { environment: 'jsdom', include: ['docs/reviews/evidence/*.test.tsx'] },
});
