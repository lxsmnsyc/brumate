import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

// Built with `vite build dashboard`, so the root is this folder.
export default defineConfig({
  plugins: [brumate({ navigate: false })],
  build: {
    // The adapter reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
