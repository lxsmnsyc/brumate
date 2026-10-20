import brumate from 'brumate/vite';
import { defineConfig } from 'vite';
import markdown from './plugins/markdown.ts';
import showcase from './plugins/showcase.ts';

export default defineConfig({
  // `BASE` is the path the site is served from, such as `/brumate/`.
  base: process.env.BASE ?? '/',
  plugins: [markdown(), showcase(), brumate()],
  build: {
    // The prerender script reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
