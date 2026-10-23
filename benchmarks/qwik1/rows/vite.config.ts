import { qwikVite } from '@builder.io/qwik/optimizer';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    qwikVite({
      client: { outDir: 'dist/client' },
      ssr: { outDir: 'dist/server' },
    }),
  ],
});
