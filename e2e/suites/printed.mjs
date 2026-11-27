// Raw HTML that the page state leaves out and reads back from the page, in Chrome's parser. The
// suite compiles small components with the built package, renders them, and serves the pages.
// Each case is one that happy-dom does not parse as Chrome does.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert, freePort, repo, watch } from '../lib.mjs';

const dist = path.join(repo, 'packages/brumate/dist');
const output = path.join(repo, 'e2e/.output/printed');

// The build of the package is enough: `pnpm build` of the run makes it.
export const build = [];

/** Long HTML, as the docs of the website hold. */
function makeSection(name) {
  return `<h2 id="${name}">${name} &amp; more</h2>\n<p>Text of <code>${name}</code>, with <em>stress</em>.</p>\n`.repeat(
    6,
  );
}

/**
 * The cases: the elements around the insert, the raw HTML, and whether the page state may read
 * it back. Only `plain` may: the others stay in the state.
 */
const CASES = {
  plain: { open: '<div class="w">', close: '</div>', doc: makeSection('plain'), printed: true },
  // After `</body>` the parser puts the end marker in `<html>`.
  document: {
    open: '<div class="w">',
    close: '</div>',
    doc: `<html><head></head><body>${makeSection('document')}</body></html>`,
  },
  // A `<button>` of the HTML closes the `<button>` around.
  button: {
    open: '<button class="w"><div>',
    close: '</div></button>',
    doc: `${makeSection('button')}<button>b</button>`,
  },
  // An `<li>` of the HTML closes the `<li>` around, through the `<div>`.
  item: {
    open: '<ul><li class="w"><div>',
    close: '</div></li></ul>',
    doc: `<li>${makeSection('item')}</li><li>two</li>`,
  },
  // The script runs before the record reads the range.
  script: {
    open: '<div class="w">',
    close: '</div>',
    doc: `<p id="q">${makeSection('script')}</p><script>q.textContent = 'changed by script';</script>`,
  },
};

function makeProbe({ open, close }) {
  return `<script>
  import { $props, $signal } from 'brumate/signals';

  const { doc } = $props();
  let key = $signal(0);
</script>

<button class="key" onClick=(() => key++)>key</button>
${open}
  #key (key) {
    {doc}
  }
${close}
`;
}

// A \`#try\` whose \`#loading\` fails: a render in order puts the \`#catch\` body in the page.
const TRY = `<script>
  import { $props, $memo } from 'brumate/signals';

  const { doc } = $props();

  async function fail() {
    throw new Error('The memo fails');
  }

  const late = $memo(fail());
</script>

#try {
  <div class="doc">{doc}</div>
  #loading (late) {
    <span>{late}</span>
  } #else {
    <p class="fallback">Loading</p>
  }
  <p class="after">after</p>
} #catch (error) {
  <p class="caught">caught</p>
}
`;

const FORGED = `<script>
  import { $props, $signal } from 'brumate/signals';

  const { first, second } = $props();
  let key = $signal(0);
</script>

<button class="key" onClick=(() => key++)>key</button>
#key (key) {
  <div class="first">{first}</div>
  <div class="second">{second}</div>
}
`;

/** Compiles a component with the built package, and imports its server module. */
async function loadComponent(compile, name, source) {
  const { server } = compile(source, { filename: `${name}.brm` });
  const file = path.join(output, `${name}.ts`);
  const runtime = pathToFileURL(path.join(dist, 'runtime/server.js')).href;
  writeFileSync(file, server.replaceAll("'brumate/server'", `'${runtime}'`));
  return (await import(pathToFileURL(file).href)).default;
}

function wrapPage(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>printed</title></head><body>${body}</body></html>`;
}

// The page of each case, and the HTML of each case printed between markers, as the prototype did.
const pages = new Map();

export async function start() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const { compile } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
  const { raw, render } = await import(pathToFileURL(path.join(dist, 'runtime/server.js')).href);
  let reader = '';
  for (const [name, item] of Object.entries(CASES)) {
    const Probe = await loadComponent(compile, name, makeProbe(item));
    const { html, state } = await render(Probe, { doc: raw(item.doc) });
    pages.set(`/${name}`, { html: wrapPage(html + state), state, item });
    reader ||= /(\(function\(\)\{var w=document[\s\S]*?\)\(\);)\$bR\(/.exec(state)?.[1] ?? '';
  }
  assert(reader, 'the page state of the plain case has no reader');
  for (const [name, item] of Object.entries(CASES)) {
    const marked = `${item.open}<!--dzzzz.0-->${item.doc}<!--/d-->${item.close}`;
    pages.set(`/marked/${name}`, { html: wrapPage(`${marked}<script>${reader}</script>`) });
  }
  // Raw HTML that copies the marker of a value, before it and after it.
  const Forged = await loadComponent(compile, 'forged', FORGED);
  const real = raw(makeSection('forged'));
  const probe = await render(Forged, { first: raw('x'), second: real });
  const token = /<!--d([\da-z]{4}\.0)-->/.exec(probe.html)?.[1];
  assert(token, 'the real value of the forged case has no marker');
  const fake = raw(`<!--d${token}--><p class="evil">evil</p><!--/d-->`);
  for (const [name, props] of [
    ['before', { first: fake, second: real }],
    ['after', { first: real, second: fake }],
  ]) {
    const { html, state } = await render(Forged, props);
    pages.set(`/forged/${name}`, { html: wrapPage(html + state), state, token });
  }

  const Try = await loadComponent(compile, 'try', TRY);
  const doc = raw(makeSection('try'));
  // The memo fails on purpose, so its error is not logged.
  const quiet = () => {};
  const inOrder = await render(Try, { doc }, { inOrder: true, onError: quiet });
  pages.set('/try/in-order', {
    html: wrapPage(inOrder.html + inOrder.state),
    state: inOrder.state,
  });
  const streamed = await render(Try, { doc }, { onError: quiet });
  let rest = '';
  for await (const chunk of streamed.pending) {
    rest += chunk;
  }
  pages.set('/try/streamed', {
    html: wrapPage(streamed.html + streamed.state + rest),
    state: streamed.state,
  });

  const port = await freePort();
  const server = createServer((request, response) => {
    const page = pages.get(request.url ?? '');
    response.writeHead(page ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page?.html ?? 'Not found');
  });
  await new Promise((resolve) => server.listen(port, resolve));
  const url = `http://localhost:${port}`;
  return { url, stop: () => new Promise((resolve) => server.close(() => resolve())) };
}

/** The tokens of `$b.d` in a state record. */
function readTokens(state) {
  return [...state.matchAll(/\$b\.d\("([\da-z]{4}\.\d+)"/g)].map((match) => match[1]);
}

/** Reads the page after it loads: the markers left, and the ranges that the record read. */
async function inspectPage(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    let markers = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/^\/?d([\da-z]{4}\.\d+)?$/.test(node.data)) {
        markers++;
      }
    }
    return { markers, read: { ...self.$bP } };
  });
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  const step = (name, check) => runner.step('printed', name, { page, errors }, check);

  for (const [name, item] of Object.entries(CASES)) {
    await step(`${name}: the page reads back every value that its state leaves out`, async () => {
      const { state } = pages.get(`/${name}`);
      const wanted = readTokens(state);
      assert(
        wanted.length === (item.printed ? 1 : 0),
        `the state of ${name} leaves out ${wanted.length} values`,
      );
      const { markers, read } = await inspectPage(page, `${url}/${name}`);
      assert(markers === 0, `${markers} markers stay in the page`);
      for (const token of wanted) {
        assert(read[token]?.includes(`${name} &amp; more`), `the page did not read ${token}`);
      }
    });
  }

  // The same HTML between markers, which the branch does not print: Chrome moves or changes it.
  for (const name of ['document', 'button', 'item']) {
    await step(
      `${name}: Chrome moves the end marker of the HTML, so it stays in the state`,
      async () => {
        const { read } = await inspectPage(page, `${url}/marked/${name}`);
        assert(!('zzzz.0' in read), 'Chrome kept the range');
      },
    );
  }
  await step(
    'script: the script changes the HTML before the read, so it stays in the state',
    async () => {
      const { read } = await inspectPage(page, `${url}/marked/script`);
      assert(read['zzzz.0']?.includes('changed by script'), 'the script did not change the range');
    },
  );

  for (const name of ['before', 'after']) {
    await step(`forged ${name}: a copy of a marker leaves the value in the state`, async () => {
      const { state, token } = pages.get(`/forged/${name}`);
      assert(readTokens(state).length === 0, 'the state leaves out a value whose marker is copied');
      assert(state.includes('forged &amp; more'), 'the state does not hold the real value');
      const { markers, read } = await inspectPage(page, `${url}/forged/${name}`);
      assert(markers === 0, `${markers} markers stay in the page`);
      assert(!(token in read), `the page read ${token}: ${read[token]}`);
      assert((await page.locator('.evil').count()) === 1, 'the raw HTML of the copy is gone');
    });
  }

  await step('#try in order: the #catch body replaces the whole body, with no marker', async () => {
    const { state } = pages.get('/try/in-order');
    assert(readTokens(state).length === 0, 'the state of a render in order leaves out values');
    const { markers } = await inspectPage(page, `${url}/try/in-order`);
    assert(markers === 0, `${markers} markers stay in the page`);
    assert((await page.locator('.caught').count()) === 1, 'no #catch body');
    for (const selector of ['.doc', '.fallback', '.after']) {
      assert((await page.locator(selector).count()) === 0, `${selector} stays in the page`);
    }
  });

  await step(
    '#try streamed: the page reads the value before the #catch body swaps in',
    async () => {
      const { state } = pages.get('/try/streamed');
      const wanted = readTokens(state);
      assert(wanted.length === 1, `the state leaves out ${wanted.length} values`);
      const { markers, read } = await inspectPage(page, `${url}/try/streamed`);
      assert(markers === 0, `${markers} markers stay in the page`);
      assert(read[wanted[0]]?.includes('try &amp; more'), `the page did not read ${wanted[0]}`);
    },
  );
  await page.close();
}
