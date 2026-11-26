import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate()],
  build: {
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
