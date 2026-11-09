import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import brumate from '../brumate/src/vite.ts';

function resolveRuntime(file: string): string {
  return fileURLToPath(new URL(`../brumate/src/runtime/${file}.ts`, import.meta.url));
}

// Components compile with the compiler and run with the runtime of brumate from
// source, so a stale packages/brumate/dist cannot hide a change. They render on
// the server and resume in happy-dom, with brumate/testing.
export default defineConfig({
  plugins: [brumate()],
  resolve: {
    alias: {
      'brumate/server': resolveRuntime('server'),
      'brumate/client': resolveRuntime('client'),
      'brumate/loader': resolveRuntime('loader'),
      'brumate/static-loader': resolveRuntime('static-loader'),
      'brumate/bundles': resolveRuntime('bundles'),
      'brumate/context': resolveRuntime('context'),
      'brumate/html': resolveRuntime('html'),
      'brumate/signals': resolveRuntime('signals'),
      'brumate/testing': resolveRuntime('testing'),
      'brumate/env': resolveRuntime('env'),
      'brumate/routes': resolveRuntime('routes'),
      'brumate/batch': resolveRuntime('batch'),
      'brumate/events': resolveRuntime('events'),
      'brumate/serial': resolveRuntime('values'),
      'brumate/stream': resolveRuntime('gather'),
      'brumate/forms/core': resolveRuntime('forms'),
      'brumate/devtools': resolveRuntime('devtools'),
      'brumate/hot': resolveRuntime('hot'),
    },
  },
  test: { environment: 'happy-dom' },
});
