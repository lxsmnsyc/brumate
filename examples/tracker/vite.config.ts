import brumate from 'brumate/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    brumate({
      // Pages change inside a view transition, where the browser supports them.
      navigate: { transition: true },
      // /about, /from, /team and the pages of /titles have no data. The build writes /from and
      // /titles to .output/public, which Nitro serves as files. /about and /team have a #defer
      // line for the user, so they go to the server assets and the routes send them as the shell.
      prerender: { paths: ['/about', '/from', '/team', '/titles', '/titles/other'], crawl: false },
    }),
    nitro(),
  ],
  environments: {
    // The entry that the browser loads. Brumate writes its script tag.
    client: { build: { rollupOptions: { input: 'src/client.ts' } } },
  },
});
