// The page of the workbench in the dev server: a list of the components on the left, and on
// the right the controls of the props of the one that is picked, above a frame that renders it.
// The frame renders on the server and resumes in the browser, as a page does.

/** The HTML of the workbench page. `base` is the path of the workbench, such as `/__brumate/workbench`. */
export function workbenchPage(base: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workbench</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbf8f3; --panel: #fffdfa; --ink: #24211e; --muted: #6f675f; --line: #e6dfd6;
    --accent: #e0633a; --soft: #f6f1ea;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #181513; --panel: #211e1b; --ink: #eee8e1; --muted: #a89f95; --line: #3a342f;
      --accent: #f08158; --soft: #2a2622; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; display: grid; grid-template-columns: 17rem minmax(0, 1fr); height: 100vh;
    background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, sans-serif; }
  aside { overflow: auto; padding: 1rem; border-right: 1px solid var(--line); background: var(--panel); }
  aside h1 { margin: 0 0 1rem; font-size: 1rem; }
  aside h2 { margin: 1rem 0 0.25rem; color: var(--muted); font-size: 0.75rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em; }
  aside button { display: block; width: 100%; padding: 0.3rem 0.5rem; border: 0; border-radius: 6px;
    background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  aside button:hover { background: var(--soft); }
  aside button[aria-current="true"] { background: var(--soft); color: var(--accent); font-weight: 600; }
  details { margin-top: 1.5rem; color: var(--muted); }
  details li { margin: 0.4rem 0; }
  details code { color: var(--ink); }
  main { display: grid; grid-template-rows: auto auto minmax(0, 1fr); min-width: 0; }
  header { display: flex; align-items: baseline; gap: 0.75rem; padding: 1rem 1.25rem 0.5rem; }
  header h2 { margin: 0; font-size: 1.1rem; }
  header span { color: var(--muted); font-family: ui-monospace, monospace; font-size: 12px; }
  header a { margin-left: auto; color: var(--accent); }
  form { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; padding: 0.5rem 1.25rem 1rem;
    border-bottom: 1px solid var(--line); }
  label { display: grid; gap: 0.2rem; color: var(--muted); font-size: 12px; }
  label.box { display: flex; align-items: center; gap: 0.4rem; color: var(--ink); font-size: 14px; }
  input, select, textarea { padding: 0.35rem 0.5rem; border: 1px solid var(--line); border-radius: 6px;
    background: var(--bg); color: var(--ink); font: inherit; }
  textarea { width: 18rem; min-height: 4rem; font-family: ui-monospace, monospace; font-size: 12px; }
  .invalid { border-color: #c0392b; }
  iframe { width: 100%; height: 100%; border: 0; background: #fff; }
  .empty { padding: 2rem 1.25rem; color: var(--muted); }
</style>
</head>
<body>
<aside>
  <h1>Workbench</h1>
  <nav id="list"></nav>
  <details id="others"><summary>Need the environment</summary><ul id="needs"></ul></details>
</aside>
<main>
  <header><h2 id="name">Pick a component</h2><span id="file"></span><a id="open" target="_blank" hidden>Open alone</a></header>
  <form id="controls"></form>
  <div id="stage" class="empty">The components here depend only on their props and their own state, so each one renders on the server and resumes as it would in a page.</div>
</main>
<script type="module">
const base = ${JSON.stringify(base)};
const list = document.getElementById('list');
const needsList = document.getElementById('needs');
const form = document.getElementById('controls');
const stage = document.getElementById('stage');
const components = await (await fetch(base + '/components')).json();
let current;
let values = {};
let timer;

const REASONS = {
  server: 'calls the server function', request: 'reads the request with', route: 'reads the route with',
  context: 'reads a context with', action: 'has the form action', defer: 'has a', dynamic: 'renders a dynamic tag',
  component: 'renders a component that the workbench cannot find,',
};

function frameUrl() {
  const props = encodeURIComponent(JSON.stringify(values));
  return base + '/frame?file=' + encodeURIComponent(current.file) + '&props=' + props;
}

function render() {
  const url = frameUrl();
  document.getElementById('open').href = url;
  let frame = stage.querySelector('iframe');
  if (!frame) {
    stage.className = '';
    stage.textContent = '';
    frame = document.createElement('iframe');
    frame.title = current.name;
    stage.append(frame);
  }
  frame.src = url;
}

function later() {
  clearTimeout(timer);
  timer = setTimeout(render, 250);
}

function control(spec) {
  const label = document.createElement('label');
  const set = (value) => {
    if (value === undefined) delete values[spec.name];
    else values[spec.name] = value;
    later();
  };
  if (spec.kind === 'boolean') {
    label.className = 'box';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(values[spec.name]);
    input.addEventListener('change', () => set(input.checked));
    label.append(input, spec.name);
    return label;
  }
  label.append(spec.name + (spec.optional ? '' : ' *'));
  let input;
  if (spec.kind === 'choice') {
    input = document.createElement('select');
    const options = spec.optional ? ['', ...spec.options] : spec.options;
    for (const option of options) {
      const item = document.createElement('option');
      item.value = String(option);
      item.textContent = option === '' ? '(none)' : String(option);
      input.append(item);
    }
    input.value = values[spec.name] === undefined ? '' : String(values[spec.name]);
    input.addEventListener('change', () => {
      const picked = spec.options.find((option) => String(option) === input.value);
      set(picked);
    });
  } else if (spec.kind === 'json') {
    input = document.createElement('textarea');
    input.value = values[spec.name] === undefined ? '' : JSON.stringify(values[spec.name], null, 2);
    input.addEventListener('input', () => {
      if (input.value.trim() === '') {
        input.classList.remove('invalid');
        set(undefined);
        return;
      }
      try {
        const value = JSON.parse(input.value);
        input.classList.remove('invalid');
        set(value);
      } catch {
        input.classList.add('invalid');
      }
    });
  } else {
    input = document.createElement('input');
    input.type = spec.kind === 'number' ? 'number' : 'text';
    input.value = values[spec.name] === undefined ? '' : String(values[spec.name]);
    input.addEventListener('input', () => {
      if (input.value === '') set(undefined);
      else set(spec.kind === 'number' ? Number(input.value) : input.value);
    });
  }
  label.append(input);
  return label;
}

function pick(component, button) {
  current = component;
  values = {};
  for (const spec of component.controls) {
    if (spec.default !== undefined) values[spec.name] = spec.default;
    // A required prop gets a value, so the component renders at once.
    else if (!spec.optional) {
      values[spec.name] =
        spec.kind === 'text' ? spec.name
        : spec.kind === 'number' ? 0
        : spec.kind === 'boolean' ? false
        : spec.kind === 'choice' ? spec.options[0]
        : (spec.empty ?? null);
    }
  }
  for (const other of list.querySelectorAll('button')) other.setAttribute('aria-current', String(other === button));
  document.getElementById('name').textContent = component.name;
  document.getElementById('file').textContent = component.file;
  document.getElementById('open').hidden = false;
  form.replaceChildren(...component.controls.map(control));
  history.replaceState(null, '', '#' + component.file);
  render();
}

const folders = new Map();
for (const component of components) {
  if (!component.selfContained) {
    const item = document.createElement('li');
    const reasons = component.needs.map((need) =>
      (REASONS[need.kind] ?? need.kind) + ' ' + need.name + (need.via ? ' (through ' + need.via + ')' : ''));
    item.innerHTML = '<code></code>: ';
    item.querySelector('code').textContent = component.name;
    item.append(reasons.join('; '));
    needsList.append(item);
    continue;
  }
  const folder = component.file.split('/').slice(0, -1).join('/') || '.';
  if (!folders.has(folder)) folders.set(folder, []);
  folders.get(folder).push(component);
}
for (const [folder, items] of [...folders].sort(([a], [b]) => a.localeCompare(b))) {
  const heading = document.createElement('h2');
  heading.textContent = folder;
  list.append(heading);
  for (const component of items) {
    const button = document.createElement('button');
    button.textContent = component.name;
    button.addEventListener('click', () => pick(component, button));
    list.append(button);
  }
}
if (!needsList.children.length) document.getElementById('others').hidden = true;
if (!folders.size) list.textContent = 'No component depends only on its props.';
const chosen = decodeURIComponent(location.hash.slice(1));
const first = components.find((component) => component.selfContained && component.file === chosen);
if (first) pick(first, [...list.querySelectorAll('button')].find((button) => button.textContent === first.name));
</script>
</body>
</html>`;
}
