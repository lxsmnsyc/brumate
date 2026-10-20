import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';
import markdown from './plugins/markdown.ts';
import search from './plugins/search.ts';
import showcase from './plugins/showcase.ts';

const require = createRequire(import.meta.url);

export default defineConfig({
  // `BASE` is the path the site is served from, such as `/brumate/`.
  base: process.env.BASE ?? '/',
  plugins: [
    markdown(),
    showcase(),
    search([
      fileURLToPath(new URL('docs', import.meta.url)),
      fileURLToPath(new URL('../docs', import.meta.url)),
    ]),
    brumate(),
  ],
  resolve: {
    alias: {
      // The browser build of oxc-parser imports its WebAssembly binding by this name.
      '@oxc-parser/binding-wasm32-wasip1': path.join(
        path.dirname(require.resolve('@oxc-parser/binding-wasm32-wasi/package.json')),
        'parser.wasi-browser.js',
      ),
    },
  },
  // The compiler of the playground parses with oxc on WebAssembly, which loads its files itself.
  optimizeDeps: {
    exclude: ['oxc-parser', '@oxc-parser/binding-wasm32-wasi'],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2023',
    // The playground chunk holds the compiler and PostCSS.
    chunkSizeWarningLimit: 1200,
    // The prerender script reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
