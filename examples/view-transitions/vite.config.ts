import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate({ navigate: { transition: true } })],
  build: {
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
