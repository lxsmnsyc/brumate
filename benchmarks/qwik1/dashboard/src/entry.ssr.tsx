import { renderToStream, type RenderToStreamOptions } from '@builder.io/qwik/server';
import { manifest } from '@qwik-client-manifest';
import Root from './root';

// `renderToString` of Qwik 1.20 drops the `preloader` option, so the page with the preloader off
// renders with `renderToStream`, which `renderToString` calls with the same options otherwise.
export default async function render(opts: Partial<RenderToStreamOptions>) {
  const chunks: string[] = [];
  const stream = { write: (chunk: string) => void chunks.push(chunk) };
  await renderToStream(<Root />, { manifest, ...opts, stream });
  return { html: chunks.join('') };
}
