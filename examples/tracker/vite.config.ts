import brumate from 'brumate/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      // Pages change inside a view transition, where the browser supports them.
      navigate: { transition: true },
    }),
    nitro(),
  ],
  environments: {
    // The entry that the browser loads. Brumate writes its script tag.
    client: { build: { rollupOptions: { input: 'src/client.ts' } } },
  },
});
