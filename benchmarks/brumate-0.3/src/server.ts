import { renderToStream } from 'brumate/server';
import App from './App.brm';

export function todos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Todo number ${i + 1}`,
    done: i % 3 === 0,
  }));
}

export async function page(n: number, scripts: string): Promise<string> {
  const stream = renderToStream(
    App,
    { initial: todos(n) },
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
