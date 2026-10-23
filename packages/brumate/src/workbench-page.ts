import { LOGO } from './runtime/logo.ts';

// The page of the workbench in the dev server. The sidebar lists the components that depend
// only on their props, and apart the ones that need more, with why. The canvas renders the
// picked component in a frame, on the server and resumed in the browser, as a page does, and
// the panel on the right has the controls of its props. The colors are those of the devtools.

/** The HTML of the workbench page. `base` is the path of the workbench, such as `/__brumate/workbench`. */
export function workbenchPage(base: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workbench · brumate</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}">
<style>
  :root {
    --bg: #121113; --surface: #19181a; --raised: #222023; --hover: #2a282c; --line: #2f2c31;
    --text: #ece8e4; --dim: #a39a92; --faint: #6f6862; --accent: #ee7a3e; --accent-soft: #ee7a3e22;
    --blue: #7cb7ff; --purple: #c49bff; --green: #7fd99a; --yellow: #ffd166; --red: #ff7a7a;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { height: 100%; }
  body {
    margin: 0; display: grid; grid-template-columns: 260px minmax(0, 1fr) 300px;
    background: var(--bg); color: var(--text); font: 13px/1.45 system-ui, -apple-system, sans-serif;
  }
  body.no-props { grid-template-columns: 260px minmax(0, 1fr); }
  body.no-props #props { display: none; }
  button, input, select, textarea { font: inherit; color: inherit; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 1px;
  }
  .mono { font-family: var(--mono); }

  /* Sidebar */
  #sidebar { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); background: var(--surface); }
  .brand { display: flex; align-items: center; gap: 10px; padding: 16px 16px 12px; }
  .brand .logo { display: block; width: 22px; height: 22px; }
  .brand strong { font-size: 14px; }
  .brand span { margin-left: auto; color: var(--faint); font-size: 12px; }
  .search { margin: 0 12px 8px; position: relative; }
  .search input {
    width: 100%; padding: 7px 10px 7px 30px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--bg);
  }
  .search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--faint); }
  #tree { flex: 1; overflow: auto; padding: 4px 8px 16px; }
  .group { margin-top: 10px; }
  .group-head {
    display: flex; align-items: center; gap: 6px; padding: 4px 8px; color: var(--faint);
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .group-head .count { margin-left: auto; font-weight: 500; }
  .item {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px;
    background: none; text-align: left; cursor: pointer;
  }
  .item:hover { background: var(--hover); }
  .item[aria-current="true"] { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
  .item[aria-current="true"] .label { color: #ffb48a; font-weight: 600; }
  .item .glyph { flex: none; width: 16px; height: 16px; color: var(--faint); }
  .item[aria-current="true"] .glyph { color: var(--accent); }
  .item .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .meta { margin-left: auto; color: var(--faint); font-size: 11px; white-space: nowrap; }
  .env .item .label { color: var(--dim); }
  .env .group-head { cursor: pointer; }
  .env .group-head .chev { transition: transform 0.15s; }
  .env.closed .group-head .chev { transform: rotate(-90deg); }
  .env.closed .items { display: none; }
  .kinds { display: flex; gap: 3px; margin-left: auto; }
  .dot { width: 7px; height: 7px; border-radius: 50%; }
  .note { padding: 6px 8px; color: var(--faint); font-size: 12px; }

  /* Kinds of needs */
  .k-server { --k: var(--blue); } .k-request { --k: var(--purple); } .k-route { --k: var(--green); }
  .k-context { --k: var(--yellow); } .k-action { --k: var(--red); } .k-defer { --k: var(--accent); }
  .k-dynamic { --k: var(--dim); } .k-component { --k: var(--faint); }
  .dot { background: var(--k); }
  .tag {
    display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--k) 16%, transparent); color: var(--k); font-size: 11px; font-weight: 600;
  }

  /* Canvas */
  #main { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; }
  .toolbar {
    display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 16px;
    border-bottom: 1px solid var(--line); background: var(--surface);
  }
  .title { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
  .title h1 { margin: 0; font-size: 15px; font-weight: 650; white-space: nowrap; }
  .title button { padding: 0; border: 0; background: none; color: var(--faint); font: 12px var(--mono); cursor: pointer;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title button:hover { color: var(--blue); text-decoration: underline; }
  .tools { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .segment { display: flex; padding: 2px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
  .segment button, .tool {
    display: grid; place-items: center; height: 26px; min-width: 28px; padding: 0 8px; border: 0; border-radius: 6px;
    background: none; color: var(--dim); cursor: pointer;
  }
  .segment button[aria-pressed="true"] { background: var(--raised); color: var(--text); }
  .tool { border: 1px solid var(--line); background: var(--bg); }
  .tool:hover, .segment button:hover { color: var(--text); }
  .canvas { position: relative; display: grid; place-items: center; overflow: auto; padding: 24px; }
  .canvas.dots { background: radial-gradient(circle, #ffffff14 1px, transparent 1px) 0 0 / 16px 16px, var(--bg); }
  .canvas.light { background: #f4f1ec; }
  .canvas.dark { background: #0b0a0b; }
  .device {
    width: 100%; height: 100%; border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
    background: #fff; box-shadow: 0 12px 40px #0006; transition: width 0.2s, height 0.2s;
  }
  .device iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
  .size { position: absolute; right: 16px; bottom: 10px; color: var(--faint); font: 11px var(--mono); }

  /* Cards on the canvas: the start, and a component that needs the environment */
  .card {
    width: min(520px, 100%); padding: 24px 26px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
  }
  .card .eyebrow { color: var(--accent); font-size: 12px; font-weight: 600; }
  .card h2 { margin: 6px 0 8px; font-size: 18px; }
  .card p { margin: 0 0 14px; color: var(--dim); }
  .needs { display: grid; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }
  .needs li { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; align-items: baseline;
    padding: 10px 12px; border-radius: 10px; background: var(--raised); }
  .needs .what { font-family: var(--mono); }
  .needs .via { grid-column: 2; color: var(--faint); font-size: 12px; }
  .hint { padding: 10px 12px; border-left: 2px solid var(--accent); border-radius: 0 8px 8px 0; background: var(--accent-soft);
    color: var(--dim); font-size: 12px; }
  .hint code { color: #ffb48a; }
  .stats { display: flex; gap: 18px; margin-top: 4px; }
  .stats div { color: var(--faint); font-size: 12px; }
  .stats strong { display: block; color: var(--text); font-size: 22px; font-weight: 650; }

  /* Props */
  #props { display: flex; flex-direction: column; min-height: 0; border-left: 1px solid var(--line); background: var(--surface); }
  .panel-head { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 8px 16px; border-bottom: 1px solid var(--line); }
  .panel-head h2 { margin: 0; font-size: 13px; }
  .panel-head button { margin-left: auto; }
  #controls { flex: 1; overflow: auto; padding: 8px 0; }
  .prop { padding: 10px 16px; border-bottom: 1px solid #ffffff08; }
  .prop-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .prop-head .name { color: #ffc28f; font-family: var(--mono); }
  .prop-head .req { color: var(--accent); }
  .prop-head .type { margin-left: auto; color: var(--faint); font: 11px var(--mono); }
  .prop-head .reset { padding: 0 4px; border: 0; background: none; color: var(--faint); cursor: pointer; visibility: hidden; }
  .prop.changed .reset { visibility: visible; }
  .prop-head .reset:hover { color: var(--text); }
  .prop input[type="text"], .prop input[type="number"], .prop select, .prop textarea {
    width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg);
  }
  .prop textarea { min-height: 76px; resize: vertical; font: 12px/1.5 var(--mono); }
  .prop .invalid { border-color: var(--red); }
  .error { margin-top: 4px; color: var(--red); font-size: 11px; }
  .switch { position: relative; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: var(--dim); }
  .switch input { position: absolute; opacity: 0; }
  .switch span { width: 30px; height: 18px; border-radius: 999px; background: var(--raised); border: 1px solid var(--line); position: relative; transition: background 0.15s; }
  .switch span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--dim); transition: transform 0.15s; }
  .switch input:checked + span { background: var(--accent); border-color: var(--accent); }
  .switch input:checked + span::after { transform: translateX(12px); background: #fff; }
  .switch input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 1px; }
  .choices { display: flex; flex-wrap: wrap; gap: 4px; }
  .choices button { padding: 3px 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--dim); cursor: pointer; font: 12px var(--mono); }
  .choices button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: #ffb48a; }
  .empty-props { padding: 16px; color: var(--faint); }
  .footer { padding: 10px 16px; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px; }
</style>
</head>
<body class="no-props">
<aside id="sidebar">
  <div class="brand"><span class="logo">${LOGO}</span><strong>Workbench</strong><span id="total"></span></div>
  <label class="search">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="m11 11 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    <input id="filter" type="search" placeholder="Find a component" aria-label="Find a component">
  </label>
  <nav id="tree" aria-label="Components"></nav>
</aside>
<main id="main">
  <div class="toolbar">
    <div class="title"><h1 id="name">Workbench</h1><button id="file" type="button" title="Open in your editor" hidden></button></div>
    <div class="tools" id="tools" hidden>
      <div class="segment" role="group" aria-label="Width">
        <button type="button" data-width="" aria-pressed="true" title="Fill the canvas">Fill</button>
        <button type="button" data-width="390" title="Phone, 390 px">390</button>
        <button type="button" data-width="768" title="Tablet, 768 px">768</button>
        <button type="button" data-width="1280" title="Desktop, 1280 px">1280</button>
      </div>
      <div class="segment" role="group" aria-label="Background">
        <button type="button" data-canvas="dots" aria-pressed="true" title="Dots">Dots</button>
        <button type="button" data-canvas="light" title="Light">Light</button>
        <button type="button" data-canvas="dark" title="Dark">Dark</button>
      </div>
      <button class="tool" id="reload" type="button" title="Render again">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <a class="tool" id="open" target="_blank" title="Open alone in a new tab">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9 3h4v4M13 3 7.5 8.5M12 9.5V13H3V4h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>
  </div>
  <div class="canvas dots" id="canvas"></div>
</main>
<aside id="props">
  <div class="panel-head"><h2>Props</h2><button class="tool" id="resetAll" type="button" title="Reset every prop">Reset</button></div>
  <div id="controls"></div>
  <div class="footer">From the type of <span class="mono">$props&lt;T&gt;()</span>. Function props have no control.</div>
</aside>
<script type="module">
const base = ${JSON.stringify(base)};
const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter((child) => child !== undefined && child !== null));
  return node;
};
const svg = (markup) => {
  const holder = document.createElement('span');
  holder.innerHTML = markup;
  return holder.firstChild;
};
const COMPONENT = '<svg class="glyph" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 8h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const LOCKED = '<svg class="glyph" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.4"/></svg>';
const FOLDER = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" stroke="currentColor" stroke-width="1.4"/></svg>';
const CHEVRON = '<svg class="chev" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// What each kind of need is, in words, for the tags and the card.
const KINDS = {
  server: ['Server', 'calls the server function'],
  request: ['Request', 'reads the request with'],
  route: ['Route', 'reads the route with'],
  context: ['Context', 'reads a context with'],
  action: ['Action', 'has the form action'],
  defer: ['Defer', 'has a block that the server renders later:'],
  dynamic: ['Dynamic tag', 'renders a dynamic tag'],
  component: ['Unknown', 'renders a component that the workbench cannot find:'],
};
const TYPES = { text: 'string', number: 'number', boolean: 'boolean', json: 'JSON' };

const components = await (await fetch(base + '/components')).json();
const ready = components.filter((component) => component.selfContained);
const others = components.filter((component) => !component.selfContained);
let current;
let values = {};
let start = {};
let timer;
let width = '';
let envOpen = false;

function frameUrl() {
  return base + '/frame?file=' + encodeURIComponent(current.file) + '&props=' + encodeURIComponent(JSON.stringify(values));
}

function render() {
  const url = frameUrl();
  $('open').href = url;
  let frame = $('canvas').querySelector('iframe');
  if (!frame) {
    frame = make('iframe', { title: current.name });
    $('canvas').replaceChildren(make('div', { class: 'device', id: 'device' }, frame), make('div', { class: 'size', id: 'size' }));
    applyWidth();
  }
  frame.src = url;
}

function later() {
  clearTimeout(timer);
  timer = setTimeout(render, 200);
}

function applyWidth() {
  const device = $('device');
  if (!device) return;
  device.style.width = width ? width + 'px' : '100%';
  device.style.maxWidth = '100%';
  $('size').textContent = width ? width + ' px' : '';
}

function set(name, value) {
  if (value === undefined) delete values[name];
  else values[name] = value;
  for (const row of $('controls').querySelectorAll('.prop')) {
    row.classList.toggle('changed', JSON.stringify(values[row.dataset.name]) !== JSON.stringify(start[row.dataset.name]));
  }
  later();
}

function input(spec) {
  const value = values[spec.name];
  if (spec.kind === 'boolean') {
    const box = make('input', { type: 'checkbox', onchange: () => set(spec.name, box.checked) });
    box.checked = Boolean(value);
    return make('label', { class: 'switch' }, box, make('span'), spec.name);
  }
  if (spec.kind === 'choice') {
    const options = spec.optional ? [undefined, ...spec.options] : spec.options;
    if (options.length <= 5) {
      const group = make('div', { class: 'choices', role: 'group', 'aria-label': spec.name });
      for (const option of options) {
        const button = make('button', {
          type: 'button',
          'aria-pressed': String(option === value),
          onclick: () => {
            for (const other of group.children) other.setAttribute('aria-pressed', String(other === button));
            set(spec.name, option);
          },
        }, option === undefined ? 'none' : String(option));
        group.append(button);
      }
      return group;
    }
    const select = make('select', { 'aria-label': spec.name, onchange: () => set(spec.name, options[select.selectedIndex]) });
    for (const option of options) select.append(make('option', {}, option === undefined ? 'none' : String(option)));
    select.selectedIndex = Math.max(0, options.indexOf(value));
    return select;
  }
  if (spec.kind === 'json') {
    const area = make('textarea', { spellcheck: 'false', 'aria-label': spec.name });
    const error = make('div', { class: 'error', hidden: true });
    area.value = value === undefined ? '' : JSON.stringify(value, null, 2);
    area.addEventListener('input', () => {
      if (area.value.trim() === '') {
        area.classList.remove('invalid');
        error.hidden = true;
        set(spec.name, undefined);
        return;
      }
      try {
        const parsed = JSON.parse(area.value);
        area.classList.remove('invalid');
        error.hidden = true;
        set(spec.name, parsed);
      } catch (problem) {
        area.classList.add('invalid');
        error.hidden = false;
        error.textContent = String(problem.message ?? problem);
      }
    });
    return make('div', {}, area, error);
  }
  const field = make('input', {
    type: spec.kind === 'number' ? 'number' : 'text',
    'aria-label': spec.name,
    placeholder: spec.optional ? 'undefined' : '',
    oninput: () => set(spec.name, field.value === '' ? undefined : spec.kind === 'number' ? Number(field.value) : field.value),
  });
  field.value = value === undefined ? '' : String(value);
  return field;
}

function typeOf(spec) {
  if (spec.kind === 'choice') return spec.options.map((option) => JSON.stringify(option)).join(' | ');
  return TYPES[spec.kind];
}

function controls() {
  const box = $('controls');
  box.replaceChildren();
  if (!current.controls.length) {
    box.append(make('div', { class: 'empty-props' }, 'This component takes no props that the workbench can set.'));
    return;
  }
  for (const spec of current.controls) {
    const reset = make('button', { class: 'reset', type: 'button', title: 'Reset', onclick: () => {
      set(spec.name, start[spec.name]);
      controls();
    } }, '↺');
    box.append(make('div', { class: 'prop', 'data-name': spec.name },
      make('div', { class: 'prop-head' },
        make('span', { class: 'name' }, spec.name),
        spec.optional ? undefined : make('span', { class: 'req', title: 'Required' }, '*'),
        reset,
        make('span', { class: 'type', title: typeOf(spec) }, typeOf(spec).length > 28 ? 'union' : typeOf(spec))),
      input(spec)));
  }
}

function initial(component) {
  const props = {};
  for (const spec of component.controls) {
    if (spec.default !== undefined) props[spec.name] = spec.default;
    // A required prop gets a value, so the component renders at once.
    else if (!spec.optional) {
      props[spec.name] =
        spec.kind === 'text' ? spec.name
        : spec.kind === 'number' ? 0
        : spec.kind === 'boolean' ? false
        : spec.kind === 'choice' ? spec.options[0]
        : (spec.empty ?? null);
    }
  }
  return props;
}

function title(component) {
  $('name').textContent = component ? component.name : 'Workbench';
  $('file').hidden = !component;
  if (component) $('file').textContent = component.file;
}

function select(component) {
  current = component;
  for (const item of $('tree').querySelectorAll('.item')) item.setAttribute('aria-current', String(item.dataset.file === component.file));
  title(component);
  history.replaceState(null, '', '#' + component.file);
  if (!component.selfContained) {
    document.body.classList.add('no-props');
    $('tools').hidden = true;
    explain(component);
    return;
  }
  document.body.classList.remove('no-props');
  $('tools').hidden = false;
  start = initial(component);
  values = structuredClone(start);
  $('canvas').replaceChildren();
  controls();
  render();
}

function explain(component) {
  const list = make('ul', { class: 'needs' });
  for (const need of component.needs) {
    const [label, words] = KINDS[need.kind] ?? [need.kind, ''];
    list.append(make('li', {},
      make('span', { class: 'tag k-' + need.kind }, label),
      make('span', {}, words + ' ', make('span', { class: 'what' }, need.name)),
      need.via ? make('span', { class: 'via' }, 'through ' + need.via) : undefined));
  }
  const hint = make('div', { class: 'hint' });
  hint.append('Test it in a page: ', make('code', {}, 'visit()'), ' from ', make('code', {}, 'brumate/testing'),
    ', or an end-to-end test. Its parts that depend only on their props show here.');
  $('canvas').replaceChildren(make('div', { class: 'card' },
    make('div', { class: 'eyebrow' }, 'Needs the environment'),
    make('h2', {}, component.name + ' needs more than its props'),
    make('p', {}, 'The workbench renders a component with nothing around it: no request, no route, no server data and no providers. This one needs:'),
    list, hint));
}

function welcome() {
  const stats = make('div', { class: 'stats' },
    make('div', {}, make('strong', {}, String(ready.length)), 'can show here'),
    make('div', {}, make('strong', {}, String(others.length)), 'need the environment'));
  $('canvas').replaceChildren(make('div', { class: 'card' },
    make('div', { class: 'eyebrow' }, 'Workbench'),
    make('h2', {}, 'Pick a component'),
    make('p', {}, 'Each component renders on the server with the props that you set, and resumes in the browser, as it does in a page.'),
    stats));
}

function item(component) {
  const kinds = [...new Set(component.needs.map((need) => need.kind))];
  return make('button', {
    class: 'item', type: 'button', 'data-file': component.file,
    'aria-current': String(component === current),
    title: component.file,
    onclick: () => select(component),
  },
  svg(component.selfContained ? COMPONENT : LOCKED),
  make('span', { class: 'label' }, component.name),
  component.selfContained
    ? make('span', { class: 'meta' }, component.controls.length ? component.controls.length + (component.controls.length === 1 ? ' prop' : ' props') : '')
    : make('span', { class: 'kinds' }, ...kinds.map((kind) => make('span', { class: 'dot k-' + kind, title: KINDS[kind]?.[0] ?? kind }))));
}

function tree() {
  const query = $('filter').value.trim().toLowerCase();
  const match = (component) => !query || component.name.toLowerCase().includes(query) || component.file.toLowerCase().includes(query);
  const box = $('tree');
  box.replaceChildren();
  const folders = new Map();
  for (const component of ready.filter(match)) {
    const folder = component.file.split('/').slice(0, -1).join('/') || '.';
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(component);
  }
  for (const [folder, items] of [...folders].sort(([a], [b]) => a.localeCompare(b))) {
    box.append(make('div', { class: 'group' },
      make('div', { class: 'group-head' }, svg(FOLDER), folder, make('span', { class: 'count' }, String(items.length))),
      ...items.map(item)));
  }
  if (!folders.size) box.append(make('div', { class: 'note' }, query ? 'No component matches.' : 'No component depends only on its props.'));
  const shown = others.filter(match);
  if (shown.length) {
    const group = make('div', { class: 'group env' + (envOpen || query ? '' : ' closed') });
    const head = make('div', { class: 'group-head', role: 'button', tabindex: '0', 'aria-expanded': String(envOpen || Boolean(query)) },
      svg(CHEVRON), 'Needs the environment', make('span', { class: 'count' }, String(shown.length)));
    const toggle = () => {
      envOpen = group.classList.toggle('closed') === false;
      head.setAttribute('aria-expanded', String(envOpen));
    };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    group.append(head, make('div', { class: 'items' }, ...shown.map(item)));
    box.append(group);
  }
}

$('total').textContent = components.length + ' components';
$('filter').addEventListener('input', tree);
$('file').addEventListener('click', () => {
  if (current) fetch('/__open-in-editor?file=' + encodeURIComponent(current.file));
});
$('reload').addEventListener('click', render);
$('resetAll').addEventListener('click', () => {
  values = structuredClone(start);
  controls();
  render();
});
for (const button of document.querySelectorAll('[data-width]')) {
  button.addEventListener('click', () => {
    width = button.dataset.width;
    for (const other of document.querySelectorAll('[data-width]')) other.setAttribute('aria-pressed', String(other === button));
    applyWidth();
  });
}
for (const button of document.querySelectorAll('[data-canvas]')) {
  button.addEventListener('click', () => {
    $('canvas').className = 'canvas ' + button.dataset.canvas;
    for (const other of document.querySelectorAll('[data-canvas]')) other.setAttribute('aria-pressed', String(other === button));
  });
}
// The hash names the component, so a link or the back button can pick one.
function fromHash() {
  const chosen = decodeURIComponent(location.hash.slice(1));
  const found = components.find((component) => component.file === chosen);
  if (!found) {
    welcome();
    return;
  }
  if (found === current) return;
  if (!found.selfContained && !envOpen) {
    envOpen = true;
    tree();
  }
  select(found);
}
tree();
fromHash();
addEventListener('hashchange', fromHash);
</script>
</body>
</html>`;
}
