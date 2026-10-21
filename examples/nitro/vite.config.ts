import brumate from 'brumate/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

// Nitro serves the app in development, and builds it for a host: Node by default, or
// another preset, such as `NITRO_PRESET=cloudflare-module vite build`.
export default defineConfig({
  plugins: [brumate(), nitro()],
  environments: {
    // The entry that the browser loads. `src/entry-server.ts` names it with `?assets=client`.
    client: { build: { rollupOptions: { input: 'src/client.ts' } } },
  },
});
