import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

// The month grid of the context-stores spike: one provider and 42 readers.
export default defineConfig({
  plugins: [brumate({ navigate: false })],
  build: { manifest: true, rolldownOptions: { input: 'src/client.ts' } },
});
