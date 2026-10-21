// Runs SSR for one framework in its own process. The parent sends commands over IPC so
// that only one framework renders at a time.
import { gzipSync } from 'node:zlib';
import { loadAdapter } from './frameworks.mjs';

const name = process.argv[2];
const app = await (await loadAdapter(name)).load();

function text(html) {
  return html.replace(/<[^>]*>/g, '');
}

// Checks that the page shows the seeded todos, the count of open ones and the counter.
function check(html, n) {
  const body = text(html);
  const left = Array.from({ length: n }, (_, i) => i % 3 !== 0).filter(Boolean).length;
  const problems = [];
  if (n > 0 && !body.includes(`Todo number ${n}`)) problems.push(`missing "Todo number ${n}"`);
  if (!new RegExp(`${left}\\s*left`).test(body)) problems.push(`missing "${left} left"`);
  if (!/Clicked\s*0\s*times/.test(body)) problems.push('missing "Clicked 0 times"');
  return problems;
}

const commands = {
  async size({ ns }) {
    const out = {};
    for (const n of ns) {
      const html = Buffer.from(await app.render(n));
      out[n] = {
        raw: html.length,
        gzip: gzipSync(html, { level: 9 }).length,
        problems: check(String(html), n),
      };
    }
    return out;
  },
  async warmup({ n, count }) {
    for (let i = 0; i < count; i++) await app.render(n);
    return true;
  },
  async measure({ n, ms }) {
    let count = 0;
    const start = performance.now();
    while (performance.now() - start < ms) {
      await app.render(n);
      count++;
    }
    return count / ((performance.now() - start) / 1000);
  },
};

process.on('message', async ({ id, type, ...args }) => {
  try {
    process.send({ id, result: await commands[type](args) });
  } catch (error) {
    process.send({ id, error: String(error?.stack ?? error) });
  }
});
process.send({ ready: true });
