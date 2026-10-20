import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'brumate/server': fileURLToPath(new URL('./src/runtime/server.ts', import.meta.url)),
    },
  },
});
