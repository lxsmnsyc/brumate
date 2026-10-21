import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      navigate: false,
      // The dashboard scenario is a separate build with its own root. See dashboard/.
      exclude: (dir) =>
        dir === 'node_modules' || dir === 'dist' || dir === 'dashboard' || dir.startsWith('.'),
    }),
  ],
  build: {
    // The adapter reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
