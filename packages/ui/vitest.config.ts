import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import brumate from '../brumate/src/vite.ts';

const runtime = (file: string): string =>
  fileURLToPath(new URL(`../brumate/src/runtime/${file}.ts`, import.meta.url));

// Components compile with the compiler and run with the runtime of brumate from
// source, so a stale packages/brumate/dist cannot hide a change. They render on
// the server and resume in happy-dom, with brumate/testing.
export default defineConfig({
  plugins: [brumate()],
  resolve: {
    alias: {
      'brumate/server': runtime('server'),
      'brumate/client': runtime('client'),
      'brumate/loader': runtime('loader'),
      'brumate/static-loader': runtime('static-loader'),
      'brumate/context': runtime('context'),
      'brumate/html': runtime('html'),
      'brumate/signals': runtime('signals'),
      'brumate/testing': runtime('testing'),
      'brumate/env': runtime('env'),
      'brumate/routes': runtime('routes'),
      'brumate/batch': runtime('batch'),
      'brumate/events': runtime('events'),
      'brumate/serial': runtime('values'),
      'brumate/stream': runtime('gather'),
      'brumate/forms/core': runtime('forms'),
      'brumate/devtools': runtime('devtools'),
      'brumate/hot': runtime('hot'),
    },
  },
  test: { environment: 'happy-dom' },
});
