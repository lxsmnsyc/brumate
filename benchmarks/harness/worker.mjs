// Runs SSR for one framework in its own process. The parent sends commands over IPC so
// that only one framework renders at a time.
import { gzipSync } from 'node:zlib';
import { widgets } from './dashboard.mjs';
import { loadApp } from './frameworks.mjs';

const [name, scenario = 'todos'] = process.argv.slice(2);
const app = await loadApp(name, scenario);
// The dashboard page has no size. Its commands get n = 0.
const render = scenario === 'dashboard' ? () => app.render() : (n) => app.render(n);

function text(html) {
  return html.replace(/<[^>]*>/g, '');
}

// Checks that the page shows the seeded todos, the count of open ones and the counter.
function checkTodos(html, n) {
  const body = text(html);
  const left = Array.from({ length: n }, (_, i) => i % 3 !== 0).filter(Boolean).length;
  const problems = [];
  if (n > 0 && !body.includes(`Todo number ${n}`)) problems.push(`missing "Todo number ${n}"`);
  if (!new RegExp(`${left}\\s*left`).test(body)) problems.push(`missing "${left} left"`);
  if (!/Clicked\s*0\s*times/.test(body)) problems.push('missing "Clicked 0 times"');
  return problems;
}

// Checks that the page shows every widget with its first item and the label of its first mode.
function checkDashboard(html) {
  const body = text(html);
  return widgets().flatMap((widget) =>
    [widget.title, `Mode: ${widget.modes[0]}`, String(widget.items[0])]
      .filter((part) => !body.includes(part))
      .map((part) => `missing "${part}"`),
  );
}

const check = scenario === 'dashboard' ? checkDashboard : checkTodos;

const commands = {
  async size({ ns }) {
    const out = {};
    for (const n of ns) {
      const html = Buffer.from(await render(n));
      out[n] = {
        raw: html.length,
        gzip: gzipSync(html, { level: 9 }).length,
        problems: check(String(html), n),
      };
    }
    return out;
  },
  async warmup({ n, count }) {
    for (let i = 0; i < count; i++) await render(n);
    return true;
  },
  async measure({ n, ms }) {
    let count = 0;
    const start = performance.now();
    while (performance.now() - start < ms) {
      await render(n);
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
