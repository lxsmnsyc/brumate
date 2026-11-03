import { renderToStream, type ClientBundles } from 'brumate/server';
import Dashboard from './widgets/Dashboard.brm';

export async function page(scripts: string, bundles: ClientBundles): Promise<string> {
  const stream = renderToStream(
    Dashboard,
    {},
    {
      start: '<!doctype html><html><head><meta charset="utf-8"><title>bench</title></head><body>',
      end: '</body></html>',
      scripts,
      // The bundles of the client build, which the state records name so the code loads.
      bundles,
    },
  );
  let html = '';
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return html;
    html += value;
  }
}
