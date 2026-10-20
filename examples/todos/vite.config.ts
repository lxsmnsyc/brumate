import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // The build writes the stylesheets of every component into one CSS file.
  plugins: [brumate({ css: 'file' })],
  build: {
    // The production server reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
