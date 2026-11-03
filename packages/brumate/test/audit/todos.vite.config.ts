// client-audit: the todos bench build with the runtime read from src, so a source map names each
// runtime module. Usage (from benchmarks/brumate):
// npx vite build -c ../../packages/brumate/test/audit/todos.vite.config.ts --outDir <dir> --sourcemap
import { fileURLToPath } from 'node:url';
import brumate from 'brumate/vite';
import { defineConfig, type UserConfig } from 'vite';

const runtime = (file: string) =>
  fileURLToPath(new URL(`../../src/runtime/${file}`, import.meta.url));

const config: UserConfig = defineConfig({
  root: fileURLToPath(new URL('../../../../benchmarks/brumate', import.meta.url)),
  resolve: {
    alias: [
      { find: /^brumate\/client$/, replacement: runtime('client.ts') },
      { find: /^brumate\/loader$/, replacement: runtime('loader.ts') },
    ],
  },
  plugins: [
    brumate({
      navigate: false,
      exclude: (dir) =>
        dir === 'node_modules' ||
        dir === 'dist' ||
        dir === 'dashboard' ||
        dir === 'rows' ||
        dir.startsWith('.'),
    }),
  ],
  build: { manifest: true, rolldownOptions: { input: 'src/client.ts' } },
});

export default config;
