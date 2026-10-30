// Runs SSR for one framework in its own process. The parent sends commands over IPC so
// that only one framework renders at a time.
import { gzipSync } from 'node:zlib';
import { widgets } from './dashboard.mjs';
import { loadApp } from './frameworks.mjs';
import { label } from './rows.mjs';

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
  let left = 0;
  for (let i = 0; i < n; i++) {
    if (i % 3 !== 0) left++;
  }
  const problems = [];
  if (n > 0 && !body.includes(`Todo number ${n}`)) problems.push(`missing "Todo number ${n}"`);
  if (!new RegExp(`${left}\\s*left`).test(body)) problems.push(`missing "${left} left"`);
  if (!/Clicked\s*0\s*times/.test(body)) problems.push('missing "Clicked 0 times"');
  return problems;
}

// Checks that the page shows every widget with its first item and the label of its first mode.
function checkDashboard(html) {
  const body = text(html);
  const problems = [];
  for (const widget of widgets()) {
    for (const part of [widget.title, `Mode: ${widget.modes[0]}`, String(widget.items[0])]) {
      if (!body.includes(part)) problems.push(`missing "${part}"`);
    }
  }
  return problems;
}

// Checks that the page shows every row with its ID and label.
function checkRows(html, n) {
  const body = text(html);
  const problems = [];
  for (const id of [1, n]) {
    if (!body.includes(label(id))) problems.push(`missing "${label(id)}" of row ${id}`);
  }
  return problems;
}

const CHECKS = { todos: checkTodos, dashboard: checkDashboard, rows: checkRows };
const check = CHECKS[scenario];

// Encodes a render result to UTF-8 bytes, as a server must before it sends it. A string is
// encoded whole, the way `res.end(html)` does it. A stream or other iterable of chunks is
// encoded chunk by chunk as each one arrives, the way a streaming response writes it. This
// also flattens a rope string, so a renderer that builds one pays for it here.
async function encode(output) {
  if (typeof output === 'string') return [Buffer.from(output, 'utf8')];
  if (output instanceof Uint8Array) return [output];
  const chunks = [];
  for await (const chunk of output) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
  }
  return chunks;
}

// The bytes of every encoded page go into this sum, so the encoding cannot be skipped.
let sink = 0;

const commands = {
  async size({ ns }) {
    const out = {};
    for (const n of ns) {
      const html = Buffer.concat(await encode(await render(n)));
      out[n] = {
        raw: html.length,
        gzip: gzipSync(html, { level: 9 }).length,
        problems: check(String(html), n),
      };
    }
    return out;
  },
  async warmup({ n, count }) {
    for (let i = 0; i < count; i++) {
      for (const chunk of await encode(await render(n))) sink += chunk.length;
    }
    return sink > 0;
  },
  async measure({ n, ms }) {
    let count = 0;
    const start = performance.now();
    while (performance.now() - start < ms) {
      for (const chunk of await encode(await render(n))) sink += chunk.length;
      count++;
    }
    if (sink === 0) throw new Error('every page was empty');
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
