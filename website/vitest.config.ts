import { fileURLToPath } from 'node:url';

// The tests of the plugins run in Node and read brumate from its source, so a build is not needed.
// The config is a plain object and `vitest` is an alias, because the website does not depend on
// vitest: the tests run with the vitest of packages/ui (`pnpm --filter website test`).
const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default {
  resolve: {
    alias: [
      { find: /^brumate$/, replacement: here('../packages/brumate/src/index.ts') },
      { find: /^vitest$/, replacement: here('../packages/ui/node_modules/vitest/dist/index.js') },
    ],
  },
  test: { include: ['test/**/*.test.ts'] },
};
