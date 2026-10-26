import brumate from 'brumate/vite';
import { defineConfig } from 'vitest/config';

// Components render on the server and resume in happy-dom, with brumate/testing.
export default defineConfig({
  plugins: [brumate()],
  test: { environment: 'happy-dom' },
});
