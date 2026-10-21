import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      // Pages change inside a view transition, where the browser supports them.
      navigate: { transition: true },
      // /about has no data, so the build writes it to dist/client/about/index.html.
      // The other pages render on each request.
      prerender: { paths: ['/about'], crawl: false },
    }),
  ],
  build: {
    // The production server reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
