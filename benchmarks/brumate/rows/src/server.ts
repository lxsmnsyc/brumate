import { renderToStream } from 'brumate/server';
import { build } from '../../../harness/rows.mjs';
import App from './App.brm';

export async function page(n: number, scripts: string): Promise<string> {
  const stream = renderToStream(
    App,
    { initial: build(1, n) },
    {
      start: '<!doctype html><html><head><meta charset="utf-8"><title>bench</title></head><body>',
      end: '</body></html>',
      scripts,
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
