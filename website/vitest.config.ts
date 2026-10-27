import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The tests of the plugins run in Node and read brumate from its source, so a build is not needed.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^brumate$/,
        replacement: fileURLToPath(new URL('../packages/brumate/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: { include: ['test/**/*.test.ts'] },
});
