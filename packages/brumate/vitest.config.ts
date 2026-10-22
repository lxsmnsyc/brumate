import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'brumate/server': fileURLToPath(new URL('./src/runtime/server.ts', import.meta.url)),
      'brumate/client': fileURLToPath(new URL('./src/runtime/client.ts', import.meta.url)),
      'brumate/loader': fileURLToPath(new URL('./src/runtime/loader.ts', import.meta.url)),
      'brumate/static-loader': fileURLToPath(
        new URL('./src/runtime/static-loader.ts', import.meta.url),
      ),
      'brumate/signals': fileURLToPath(new URL('./src/runtime/signals.ts', import.meta.url)),
      'brumate/hot': fileURLToPath(new URL('./src/runtime/hot.ts', import.meta.url)),
      'brumate/routes': fileURLToPath(new URL('./src/runtime/routes.ts', import.meta.url)),
      'brumate/context': fileURLToPath(new URL('./src/runtime/context.ts', import.meta.url)),
      'brumate/env': fileURLToPath(new URL('./src/runtime/env.ts', import.meta.url)),
    },
  },
});
