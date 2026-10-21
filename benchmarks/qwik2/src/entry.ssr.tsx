import { renderToString, type RenderToStringOptions } from '@qwik.dev/core/server';
import { manifest } from '@qwik-client-manifest';
import Root from './root';
export default function render(opts: RenderToStringOptions) {
  return renderToString(<Root />, { manifest, ...opts });
}
