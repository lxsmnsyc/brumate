// The dashboard scenario: 50 widgets, each its own component with its own handler code.
//
// `widgets()` builds the spec of every widget from a seeded random generator, so every run and
// every framework gets the same widgets. Each handler is a pipeline of steps picked from the
// lists below, with constants of its own. `node harness/dashboard.mjs <framework>` writes the
// widget components of one framework into its `dashboard/src` folder. The build scripts run it.
//
// Handler code uses `@name` for the state of the widget. The writer of each framework turns
// `@items` into `items` (brumate, Marko) or `items.value` (Qwik). The harness runs the same code
// against a plain object to know what each click must show.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COUNT = 50;
/** Widgets in the first row, above the fold. The rest are stacked below it. */
export const TOP = 4;
/** The widgets that the browser metrics click. */
export const CLICKS = { above: 1, below: 30, third: 45 };

const NAMES = [
  'Revenue',
  'Latency',
  'Signups',
  'Churn',
  'Inventory',
  'Tickets',
  'Uptime',
  'Refunds',
  'Sessions',
  'Bounce',
  'Orders',
  'Payroll',
  'Shipping',
  'Returns',
  'Leads',
  'Renewals',
  'Storage',
  'Bandwidth',
  'Errors',
  'Deploys',
  'Builds',
  'Queue',
  'Cache',
  'Disk',
  'Memory',
  'Threads',
  'Invoices',
  'Budget',
  'Forecast',
  'Pipeline',
  'Campaigns',
  'Clicks',
  'Views',
  'Shares',
  'Ratings',
  'Surveys',
  'Visits',
  'Carts',
  'Coupons',
  'Points',
  'Shifts',
  'Fleet',
  'Routes',
  'Sensors',
  'Alerts',
  'Backups',
  'Licenses',
  'Seats',
  'Quotas',
  'Regions',
];
const VERBS = ['Apply', 'Run', 'Update', 'Compute', 'Refresh', 'Rank', 'Sort', 'Filter'];
const MODES = [
  ['Fast', 'Slow', 'Even'],
  ['Day', 'Week', 'Month'],
  ['Low', 'Mid', 'High'],
  ['Raw', 'Net', 'Gross'],
  ['North', 'South', 'West'],
  ['Sum', 'Mean', 'Peak'],
];
const SEPARATORS = [', ', ' / ', ' | ', ' ; ', ' - '];

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Steps that change `arr`, a list of integers. `m` is the mode. Each one gets its constants
// from `int(lo, hi)` and `pick(list)`.
const STEPS = [
  ({ int }) => [`arr = arr.map((v, i) => v * ${int(2, 9)} + ((i + m) % ${int(2, 7)}));`],
  ({ int }) => {
    const k = int(3, 9);
    return [`arr = arr.filter((v) => v % ${k} !== ${int(0, k - 1)});`];
  },
  ({ int, pick }) => {
    const k = int(5, 40);
    return [`arr = [...arr].sort((x, y) => ${pick(['', '-'])}((x % ${k}) - (y % ${k})) || x - y);`];
  },
  ({ int }) => [
    '{',
    '  const seen = new Set();',
    '  const kept = [];',
    '  for (const v of arr) {',
    `    const key = Math.floor(v / ${int(4, 30)});`,
    '    if (!seen.has(key)) {',
    '      seen.add(key);',
    '      kept.push(v);',
    '    }',
    '  }',
    '  arr = kept;',
    '}',
  ],
  ({ int }) => [
    '{',
    `  const r = (m + ${int(1, 5)}) % Math.max(arr.length, 1);`,
    '  arr = [...arr.slice(r), ...arr.slice(0, r)];',
    '}',
  ],
  ({ int }) => {
    const lo = int(5, 60);
    return [`arr = arr.map((v) => Math.min(Math.max(v, ${lo}), ${lo + int(100, 700)}));`];
  },
  ({ int }) => [
    '{',
    `  let acc = ${int(0, 50)};`,
    '  arr = arr.map((v) => {',
    `    acc = (acc + v) % ${int(300, 997)};`,
    '    return acc;',
    '  });',
    '}',
  ],
  ({ int }) => [
    '{',
    `  const width = ${int(2, 4)};`,
    '  arr = arr.map((_, i) => {',
    '    const part = arr.slice(Math.max(0, i - width + 1), i + 1);',
    '    return Math.round(part.reduce((s, v) => s + v, 0) / part.length);',
    '  });',
    '}',
  ],
  ({ int }) => [
    `arr = arr.map((v, i) => (i === 0 ? v : Math.abs(v - arr[i - 1]) + ${int(1, 30)}));`,
  ],
  ({ int }) => {
    const k = int(2, 4);
    return [
      '{',
      '  const out = [];',
      `  for (let i = 0; i < arr.length; i += ${k}) {`,
      `    out.push(...arr.slice(i, i + ${k}).reverse());`,
      '  }',
      '  arr = out;',
      '}',
    ];
  },
  () => [
    '{',
    '  const half = Math.ceil(arr.length / 2);',
    '  const left = arr.slice(0, half);',
    '  const right = arr.slice(half);',
    '  arr = left.flatMap((v, i) => (i < right.length ? [v, right[i]] : [v]));',
    '}',
  ],
  ({ int }) => [
    `arr = arr.map((v) => (v * ${int(3, 31)} + ${int(1, 99)} + m) % ${int(200, 999)});`,
  ],
  ({ int }) => [
    'if (m === 0) {',
    `  arr = arr.map((v) => v + ${int(1, 40)});`,
    '} else if (m === 1) {',
    `  arr = arr.map((v) => v * ${int(2, 5)});`,
    '} else {',
    `  arr = arr.map((v) => Math.floor(v / ${int(2, 6)}) + 1);`,
    '}',
  ],
  ({ int }) => [
    '{',
    '  const ranked = arr.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);',
    `  const keep = new Set(ranked.slice(0, ${int(2, 5)}).map((entry) => entry[1]));`,
    `  arr = arr.filter((_, i) => keep.has(i) || i % ${int(2, 4)} === 0);`,
    '}',
  ],
  ({ int }) => [
    'arr = arr.map((v) => {',
    '  let n = Math.abs(v);',
    '  let sum = 0;',
    '  while (n > 0) {',
    '    sum += n % 10;',
    '    n = Math.floor(n / 10);',
    '  }',
    `  return v + sum * ${int(1, 9)};`,
    '});',
  ],
  ({ int }) => [`arr = [...arr, arr.reduce((s, v) => s + v, 0) % ${int(50, 500)}];`],
  ({ int }) => [
    '{',
    '  const out = [...arr];',
    `  for (let i = ${int(0, 1)}; i + 1 < out.length; i += 2) {`,
    '    const swap = out[i];',
    '    out[i] = out[i + 1];',
    '    out[i + 1] = swap;',
    '  }',
    '  arr = out;',
    '}',
  ],
];

// Formatters that turn `arr` into the string `text`.
const FORMATS = [
  ({ int, sep }) => [
    `const text = arr.map((v) => '$' + (v / ${int(2, 20)}).toFixed(2)).join('${sep}');`,
  ],
  ({ sep }) => [
    'const top = Math.max(...arr, 1);',
    `const text = arr.map((v) => Math.round((v / top) * 100) + '%').join('${sep}');`,
  ],
  ({ word }) => [
    'const total = arr.reduce((s, v) => s + v, 0);',
    'const mean = total / arr.length;',
    `const text = '${word} min ' + Math.min(...arr) + ' max ' + Math.max(...arr) + ' mean ' + mean.toFixed(1);`,
  ],
  () => [
    "const bars = '.:-=+*#%@';",
    'const lo = Math.min(...arr);',
    'const hi = Math.max(...arr);',
    "const text = arr.map((v) => bars[hi === lo ? 0 : Math.round(((v - lo) / (hi - lo)) * 8)]).join('');",
  ],
  ({ word }) => [
    'const numerals = [',
    "  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],",
    "  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],",
    '];',
    'let n = arr.reduce((s, v) => s + v, 0) % 4000 || 1;',
    `let text = '${word} ';`,
    'for (const [value, letter] of numerals) {',
    '  while (n >= value) {',
    '    text += letter;',
    '    n -= value;',
    '  }',
    '}',
  ],
  ({ int, sep }) => [
    `const text = arr.map((v) => v.toString(16).padStart(${int(2, 4)}, '0')).join('${sep}');`,
  ],
  ({ sep }) => [
    'const suffix = (n) => {',
    '  const tens = n % 100;',
    "  if (tens >= 11 && tens <= 13) return 'th';",
    "  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';",
    '};',
    `const text = arr.map((v) => v + suffix(v)).join('${sep}');`,
  ],
  ({ int, sep }) => [
    'const text = arr',
    `  .map((v) => v * ${int(3, 40)})`,
    "  .map((v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)))",
    `  .join('${sep}');`,
  ],
  ({ sep }) => [`const text = arr.map((v) => v.toString(2)).join('${sep}');`],
  ({ int, sep }) => {
    const k = int(3, 6);
    return [
      `const buckets = new Array(${k}).fill(0);`,
      'for (const v of arr) {',
      `  buckets[Math.min(${k - 1}, Math.floor(v / ${Math.ceil(1000 / k)}))] += 1;`,
      '}',
      `const text = buckets.map((count, i) => i + ':' + count).join('${sep}');`,
    ];
  },
  ({ sep }) => [
    'const text = arr',
    '  .map((v, i) => {',
    '    if (i === 0) return String(v);',
    "    const sign = v > arr[i - 1] ? '+' : v < arr[i - 1] ? '-' : '=';",
    '    return sign + Math.abs(v - arr[i - 1]);',
    '  })',
    `  .join('${sep}');`,
  ],
  ({ int, pick }) => [
    `const text = arr.map((v) => String(v).padStart(${int(3, 5)}, '${pick(['0', '.', '_'])}')).join('|');`,
  ],
];

const SUMMARIES = [
  "@items.length + ' values, max ' + Math.max(...@items)",
  "'Sum ' + @items.reduce((s, v) => s + v, 0)",
  "'First ' + @items[0] + ', last ' + @items[@items.length - 1]",
  "'Even ' + @items.filter((v) => v % 2 === 0).length + ' of ' + @items.length",
];

function pipeline(rand, count, exclude) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const helpers = { int, pick, sep: pick(SEPARATORS), word: pick(VERBS) };
  const order = STEPS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const steps = order.slice(0, count);
  let format;
  do format = int(0, FORMATS.length - 1);
  while (format === exclude);
  return {
    format,
    lines: [
      ...steps.flatMap((i) => STEPS[i](helpers)),
      'arr = arr.map((v) => Math.abs(Math.round(v)) % 1000).slice(0, 8);',
      'while (arr.length < 3) {',
      `  arr.push((arr.length + 1) * ${int(7, 97)});`,
      '}',
      ...FORMATS[format](helpers),
    ],
  };
}

/** The spec of every widget. */
export function widgets() {
  return Array.from({ length: COUNT }, (_, index) => {
    const rand = random((index + 1) * 7919);
    const id = `w${String(index).padStart(2, '0')}`;
    const items = Array.from({ length: 6 }, () => 1 + Math.floor(rand() * 99));
    const modes = MODES[index % MODES.length];
    const run = pipeline(rand, 4);
    const cycle = pipeline(rand, 3, run.format);
    return {
      index,
      id,
      component: `Widget${String(index).padStart(2, '0')}`,
      tag: `widget-${String(index).padStart(2, '0')}`,
      title: `Widget ${index}: ${NAMES[index]}`,
      verb: VERBS[index % VERBS.length],
      items,
      modes,
      summary: SUMMARIES[index % SUMMARIES.length],
      run: [
        'const m = @mode;',
        'let arr = [...@items];',
        ...run.lines,
        '@items = arr;',
        '@output = text;',
      ],
      cycle: [
        'const m = (@mode + 1) % 3;',
        'let arr = [...@items];',
        ...cycle.lines,
        '@mode = m;',
        "@output = 'Preview ' + text;",
      ],
    };
  });
}

/** Runs a handler of a widget on a plain state object, as the browser would. */
function apply(lines, state) {
  new Function('s', lines.join('\n').replace(/@(\w+)/g, 's.$1'))(state);
  return state;
}

/** The text that each widget shows after a click on its button. */
export function expected(widget, button) {
  const state = apply(widget[button], { items: [...widget.items], mode: 0, output: 'Ready' });
  return { output: state.output, mode: `Mode: ${widget.modes[state.mode]}` };
}

const style = (widget) =>
  widget.index < TOP ? 'min-height:480px;padding:8px' : 'min-height:480px;padding:8px;margin:8px 0';
const TOP_STYLE = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px';
const label = (widget, mode) =>
  `${mode} === 0 ? '${widget.modes[0]}' : ${mode} === 1 ? '${widget.modes[1]}' : '${widget.modes[2]}'`;
const indent = (lines, pad) => lines.map((line) => pad + line).join('\n');
const reads = (lines, replacement) => lines.map((line) => line.replace(/@(\w+)/g, replacement));

// The markup of the dashboard: the first widgets in a row, the rest stacked below.
function layout(list, tag, pad) {
  const tags = (top) =>
    list
      .filter((w) => w.index < TOP === top)
      .map((w) => `${pad}  ${tag(w)}`)
      .join('\n');
  return `${pad}<h1>Dashboard</h1>
${pad}<div class="top" style="${TOP_STYLE}">
${tags(true)}
${pad}</div>
${pad}<div class="rest">
${tags(false)}
${pad}</div>`;
}

function brumateWidget(w) {
  return `<script>
  import { $memo, $signal } from 'brumate/signals';

  let items = $signal(${JSON.stringify(w.items)});
  let mode = $signal(0);
  let output = $signal('Ready');
  const summary = $memo(${w.summary.replace(/@/g, '')});

  function run() {
${indent(reads(w.run, '$1'), '    ')}
  }

  function cycle() {
${indent(reads(w.cycle, '$1'), '    ')}
  }
</script>

<section class="widget" id="${w.id}" style="${style(w)}">
  <h3>${w.title}</h3>
  <p class="summary">{summary}</p>
  <ul>
    #for (value, index of items by index) {
      <li>{value}</li>
    }
  </ul>
  <p class="out">{output}</p>
  <button class="run" onClick=run>${w.verb}</button>
  <button class="mode" onClick=cycle>Mode: {${label(w, 'mode')}}</button>
</section>
`;
}

function markoWidget(w) {
  return `<!-- Generated by benchmarks/harness/dashboard.mjs. Do not edit. -->
<let/items=${JSON.stringify(w.items)}/>
<let/mode=0/>
<let/output="Ready"/>
<const/summary=${w.summary.replace(/@/g, '')}/>
<section class="widget" id="${w.id}" style="${style(w)}">
  <h3>${w.title}</h3>
  <p class="summary">\${summary}</p>
  <ul>
    <for|value| of=items>
      <li>\${value}</li>
    </for>
  </ul>
  <p class="out">\${output}</p>
  <button class="run" onClick() {
${indent(reads(w.run, '$1'), '    ')}
  }>${w.verb}</button>
  <button class="mode" onClick() {
${indent(reads(w.cycle, '$1'), '    ')}
  }>Mode: \${${label(w, 'mode')}}</button>
</section>
`;
}

function qwikWidget(w, core) {
  return `// Generated by benchmarks/harness/dashboard.mjs. Do not edit.
import { component$, useComputed$, useSignal } from '${core}';

export const ${w.component} = component$(() => {
  const items = useSignal(${JSON.stringify(w.items)});
  const mode = useSignal(0);
  const output = useSignal('Ready');
  const summary = useComputed$(() => ${w.summary.replace(/@(\w+)/g, '$1.value')});
  return (
    <section class="widget" id="${w.id}" style="${style(w)}">
      <h3>${w.title}</h3>
      <p class="summary">{summary.value}</p>
      <ul>
        {items.value.map((value, index) => (
          <li key={index}>{value}</li>
        ))}
      </ul>
      <p class="out">{output.value}</p>
      <button
        class="run"
        onClick$={() => {
${indent(reads(w.run, '$1.value'), '          ')}
        }}
      >
        ${w.verb}
      </button>
      <button
        class="mode"
        onClick$={() => {
${indent(reads(w.cycle, '$1.value'), '          ')}
        }}
      >
        Mode: {${label(w, 'mode.value')}}
      </button>
    </section>
  );
});
`;
}

function qwik(core) {
  return {
    dir: 'widgets',
    files: (list) => ({
      ...Object.fromEntries(list.map((w) => [`${w.component}.tsx`, qwikWidget(w, core)])),
      'Dashboard.tsx': `// Generated by benchmarks/harness/dashboard.mjs. Do not edit.
import { component$ } from '${core}';
${list.map((w) => `import { ${w.component} } from './${w.component}';`).join('\n')}

export const Dashboard = component$(() => {
  return (
    <>
${layout(list, (w) => `<${w.component} />`, '      ')}
    </>
  );
});
`,
    }),
  };
}

const WRITERS = {
  brumate: {
    dir: 'widgets',
    files: (list) => ({
      ...Object.fromEntries(list.map((w) => [`${w.component}.brm`, brumateWidget(w)])),
      'Dashboard.brm': `<script>
${list.map((w) => `  import ${w.component} from './${w.component}.brm';`).join('\n')}
</script>

${layout(list, (w) => `<${w.component} />`, '')}
`,
    }),
  },
  marko: {
    dir: 'tags',
    files: (list) => ({
      ...Object.fromEntries(list.map((w) => [`${w.tag}.marko`, markoWidget(w)])),
      'dashboard-app.marko': `${layout(list, (w) => `<${w.tag}/>`, '')}\n`,
    }),
  },
  qwik1: qwik('@builder.io/qwik'),
  qwik2: qwik('@qwik.dev/core'),
};

/** Writes the generated components of a framework into `<framework>/dashboard/src/<dir>`. */
export async function write(framework) {
  const writer = WRITERS[framework];
  if (!writer) throw new Error(`No dashboard writer for "${framework}"`);
  const benchDir = fileURLToPath(new URL('..', import.meta.url));
  const dir = path.join(benchDir, framework, 'dashboard/src', writer.dir);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [file, source] of Object.entries(writer.files(widgets()))) {
    await writeFile(path.join(dir, file), source);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await write(process.argv[2]);
