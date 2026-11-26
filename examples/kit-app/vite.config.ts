import brumate from 'brumate/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate(), nitro()],
  environments: {
    // The entry that the browser loads. Brumate writes its script tag.
    client: { build: { rollupOptions: { input: 'src/client.ts' } } },
  },
});
