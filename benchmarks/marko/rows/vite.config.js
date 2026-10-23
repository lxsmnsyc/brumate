import marko from '@marko/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [marko()],
  builder: {},
  environments: {
    ssr: { build: { outDir: 'dist/server', rolldownOptions: { input: 'src/server.js' } } },
    client: { build: { outDir: 'dist/client' } },
  },
});
