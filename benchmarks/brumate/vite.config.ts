import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      navigate: false,
      // The dashboard and rows scenarios are separate builds with their own roots.
      exclude: (dir) =>
        dir === 'node_modules' ||
        dir === 'dist' ||
        dir === 'dashboard' ||
        dir === 'rows' ||
        dir.startsWith('.'),
    }),
  ],
  build: {
    // The adapter reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
