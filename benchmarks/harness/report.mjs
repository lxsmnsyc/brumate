import { OPERATIONS, RESUMED } from './client.mjs';
// Formats a result as a markdown report with one column per framework.
const num = (value) => Math.round(value).toLocaleString('en-US');
const kb = (bytes) => (bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`);
const size = (raw, gzip) => `${kb(raw)} / ${kb(gzip)}`;
const js = (entry) => (entry ? `${entry.jsFiles} · ${size(entry.jsRaw, entry.jsGzip)}` : '–');
const ms = (value) => (typeof value === 'number' ? `${value} ms` : value);

function table(names, labels, rows) {
  const lines = [
    `| Metric | ${names.map((name) => labels[name]).join(' | ')} |`,
    `| --- |${names.map(() => ' ---: |').join('')}`,
  ];
  for (const [label, cell] of rows) {
    lines.push(`| ${label} | ${names.map((name) => cell(name) ?? '–').join(' | ')} |`);
  }
  return lines.join('\n');
}

const add = (a, b) =>
  a &&
  b && {
    requests: a.requests + b.requests,
    jsFiles: a.jsFiles + b.jsFiles,
    jsRaw: a.jsRaw + b.jsRaw,
    jsGzip: a.jsGzip + b.jsGzip,
  };

function todosRows(result, metrics) {
  const fw = result.frameworks;
  const rows = [];
  const browser = (name) => fw[name].browser;

  if (metrics.has('browser')) {
    rows.push(
      ['**Browser** (3 todos; JS files · raw / gzip)', () => ''],
      ['JS before `load`', (n) => js(browser(n)?.boot)],
      [`JS fetched while idle ${result.options.idleMs / 1000} s`, (n) => js(browser(n)?.idle)],
      ['First counter click: requests', (n) => browser(n)?.firstCounter.requests],
      ['First counter click: JS', (n) => js(browser(n)?.firstCounter)],
      ['First todo toggle: requests', (n) => browser(n)?.firstToggle.requests],
      ['First todo toggle: JS', (n) => js(browser(n)?.firstToggle)],
      ['Total JS after counter, toggle, add', (n) => js(browser(n)?.total)],
      [
        'Click to update (counter / toggle / add)',
        (n) => {
          const checks = browser(n)?.checks.counterFirst;
          return checks && `${ms(checks.counter)} / ${ms(checks.toggle)} / ${ms(checks.add)}`;
        },
      ],
    );
  }
  if (metrics.has('dist')) {
    rows.push(['**Build**', () => ''], ['Client JS emitted in dist', (n) => js(fw[n].dist)]);
  }
  if (metrics.has('ssr-size')) {
    const s = (name) => fw[name].ssrSize;
    rows.push(
      ['**SSR HTML** (raw / gzip -9)', () => ''],
      ['0 todos', (n) => s(n) && size(s(n)[0].raw, s(n)[0].gzip)],
      ['3 todos', (n) => s(n) && size(s(n)[3].raw, s(n)[3].gzip)],
      ['100 todos', (n) => s(n) && size(s(n)[100].raw, s(n)[100].gzip)],
      ['Per extra todo', (n) => s(n) && `${num(s(n).perItemRaw)} B / ${num(s(n).perItemGzip)} B`],
    );
  }
  if (metrics.has('ssr-speed')) {
    const s = (name, n) => fw[name].ssrSpeed?.[n];
    const cell = (name, n) =>
      s(name, n) && `${num(s(name, n).median)} (${num(s(name, n).min)}–${num(s(name, n).max)})`;
    rows.push(
      [`**SSR renders/s** (median of ${result.options.rounds}, min–max)`, () => ''],
      ['3 todos', (n) => cell(n, 3)],
      ['100 todos', (n) => cell(n, 100)],
    );
  }
  if (metrics.has('waterfall')) {
    const w = (name, kind) => fw[name].waterfall?.[kind];
    const cell = (name, kind) =>
      w(name, kind) &&
      `${w(name, kind).roundTrips} RT · ${w(name, kind).requests} req · ${ms(w(name, kind).ms)}`;
    rows.push(
      [`**First counter click, ${result.options.latency} ms RTT**`, () => ''],
      ['After idle', (n) => cell(n, 'idle')],
      ['Right after load (cold)', (n) => cell(n, 'cold')],
    );
  }
  return rows;
}

const checks = (c) => c && `${ms(c.above)} / ${ms(c.below)} / ${ms(c.third)}`;

function dashboardRows(result, metrics) {
  const d = (name) => result.frameworks[name].dashboard ?? {};
  const b = (name) => d(name).browser;
  const off = (name) => b(name)?.preloadOff;
  const na = (name) => (b(name) && !off(name) ? 'n/a' : undefined);
  const { above, below, third } = result.options.dashboardClicks ?? {};
  const rows = [];
  if (metrics.has('browser')) {
    rows.push(
      [`**Browser** (${result.options.dashboardWidgets} widgets; JS files · raw / gzip)`, () => ''],
      ['JS before `load`', (n) => js(b(n)?.boot)],
      [`JS fetched while idle ${result.options.idleMs / 1000} s`, (n) => js(b(n)?.idle)],
      [`First click, widget ${above} (above the fold): requests`, (n) => b(n)?.above.requests],
      [`First click, widget ${above}: JS`, (n) => js(b(n)?.above)],
      [
        `First click, widget ${below} (below the fold): JS on scroll`,
        (n) => js(b(n)?.belowFirst.scroll),
      ],
      [`First click, widget ${below}: requests on click`, (n) => b(n)?.belowFirst.click.requests],
      [`First click, widget ${below}: JS on click`, (n) => js(b(n)?.belowFirst.click)],
      [
        `Widget ${below} after widget ${above} (scroll + click): JS`,
        (n) => js(add(b(n)?.scrollBelow, b(n)?.below)),
      ],
      [
        `Widget ${third} after both (scroll + click): JS`,
        (n) => js(add(b(n)?.scrollThird, b(n)?.third)),
      ],
      ['Total JS after 3 widgets', (n) => js(b(n)?.total)],
      [`Click to update (widget ${above} / ${below} / ${third})`, (n) => checks(b(n)?.checks)],
      ['**Idle preload off** (brumate: Save-Data; Qwik: `preloader: false`)', () => ''],
      [`JS fetched while idle ${result.options.idleMs / 1000} s`, (n) => na(n) ?? js(off(n)?.idle)],
      [`First click, widget ${above}: requests`, (n) => na(n) ?? off(n)?.above.requests],
      [`First click, widget ${above}: JS`, (n) => na(n) ?? js(off(n)?.above)],
      [
        `Widget ${below} after widget ${above} (scroll + click): JS`,
        (n) => na(n) ?? js(add(off(n)?.scrollBelow, off(n)?.below)),
      ],
      ['Total JS after 3 widgets', (n) => na(n) ?? js(off(n)?.total)],
      [
        `Click to update (widget ${above} / ${below} / ${third})`,
        (n) => na(n) ?? checks(off(n)?.checks),
      ],
    );
  }
  if (metrics.has('dist')) {
    rows.push(['**Build**', () => ''], ['Client JS emitted in dist', (n) => js(d(n).dist)]);
  }
  if (metrics.has('ssr-size')) {
    const s = (name) => d(name).ssrSize;
    rows.push(
      ['**SSR HTML** (raw / gzip -9)', () => ''],
      ['Dashboard page', (n) => s(n) && size(s(n).raw, s(n).gzip)],
    );
  }
  if (metrics.has('ssr-speed')) {
    const s = (name) => d(name).ssrSpeed;
    rows.push(
      [`**SSR renders/s** (median of ${result.options.rounds}, min–max)`, () => ''],
      ['Dashboard page', (n) => s(n) && `${num(s(n).median)} (${num(s(n).min)}–${num(s(n).max)})`],
    );
  }
  if (metrics.has('waterfall')) {
    const w = (name, kind) => d(name).waterfall?.[kind];
    const cell = (name, kind) =>
      w(name, kind) &&
      `${w(name, kind).roundTrips} RT · ${w(name, kind).requests} req · ${ms(w(name, kind).ms)}`;
    rows.push(
      [`**First click on widget ${above}, ${result.options.latency} ms RTT**`, () => ''],
      ['After idle', (n) => cell(n, 'idle')],
      ['Right after load (cold)', (n) => cell(n, 'cold')],
    );
  }
  return rows;
}

const mb = (bytes) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const spread = (entry) => entry && `${entry.median} (${entry.min}–${entry.max})`;

function rowsRows(result, metrics) {
  const r = (name) => result.frameworks[name].rows ?? {};
  const rows = [];
  if (metrics.has('browser')) {
    const { runs, cpu } = result.options;
    const slowdown = cpu > 1 ? `, ${cpu}× CPU slowdown` : '';
    rows.push([
      `**Main thread from click to paint, ms** (median of ${runs}, min–max${slowdown})`,
      () => '',
    ]);
    for (const [key, operation] of Object.entries(OPERATIONS)) {
      rows.push([operation.label, (n) => spread(r(n).browser?.operations[key]?.cpu)]);
    }
    rows.push([
      'JS heap after creating 1,000 rows',
      (n) => r(n).browser?.heapCreated && mb(r(n).browser.heapCreated),
    ]);
    rows.push(
      [
        `**1,000 rows from the server** (load and ${result.options.idleMs / 1000} s idle)`,
        () => '',
      ],
      ['Main thread busy, ms', (n) => spread(r(n).browser?.load?.busy)],
      ['Longest task, ms', (n) => spread(r(n).browser?.load?.longest)],
      ['JS heap', (n) => r(n).browser?.load && mb(r(n).browser.load.heap)],
    );
    for (const [key, operation] of Object.entries(RESUMED)) {
      rows.push([
        `First click: ${operation.label}, main thread / to paint, ms`,
        (n) => {
          const entry = r(n).browser?.resumed[key];
          return entry && `${entry.cpu.median} / ${entry.paint.median}`;
        },
      ]);
    }
  }
  if (metrics.has('dist')) {
    rows.push(['**Build**', () => ''], ['Client JS emitted in dist', (n) => js(r(n).dist)]);
  }
  if (metrics.has('ssr-size')) {
    const s = (name) => r(name).ssrSize;
    rows.push(
      ['**SSR HTML** (raw / gzip -9)', () => ''],
      ['1,000 rows', (n) => s(n) && size(s(n).raw, s(n).gzip)],
    );
  }
  if (metrics.has('ssr-speed')) {
    const s = (name) => r(name).ssrSpeed;
    rows.push(
      [`**SSR renders/s** (median of ${result.options.rounds}, min–max)`, () => ''],
      ['1,000 rows', (n) => s(n) && `${num(s(n).median)} (${num(s(n).min)}–${num(s(n).max)})`],
    );
  }
  return rows;
}

export function markdown(result, metrics) {
  const names = result.options.frameworks;
  const fw = result.frameworks;
  const labels = Object.fromEntries(names.map((name) => [name, fw[name].label]));
  const scenarios = result.options.scenarios ?? ['todos'];

  const m = result.machine;
  const header = [
    `# Benchmark results ${result.date}`,
    '',
    `- Machine: ${m.cpu}, ${m.cores} cores, ${m.memoryGb} GB, ${m.platform}`,
    `- Node ${m.node}; load average ${m.loadAvg.join(' ')} at start, ${m.loadAvgEnd.join(' ')} at end`,
    result.browser
      ? `- Browser: ${result.browser.version} (${result.browser.executable})`
      : undefined,
    result.git
      ? `- brumate: ${result.git.commit}${result.git.dirty ? ' with uncommitted changes in packages/' : ''}`
      : undefined,
    `- Versions: ${names
      .map(
        (name) =>
          `${labels[name]}: ${Object.entries(result.versions[name])
            .map(([dep, v]) => `${dep}@${v}`)
            .join(', ')}`,
      )
      .join('; ')}`,
    `- Scenarios: ${scenarios.join(', ')}`,
    `- Took ${result.durationSeconds} s`,
  ].filter((line) => line !== undefined);
  const notes = result.notes.length
    ? ['', '## Notes', '', ...result.notes.map((note) => `- ${note}`)]
    : [];
  const sections = [];
  if (scenarios.includes('todos'))
    sections.push('', '## Todos', '', table(names, labels, todosRows(result, metrics)));
  if (scenarios.includes('dashboard'))
    sections.push('', '## Dashboard', '', table(names, labels, dashboardRows(result, metrics)));
  if (scenarios.includes('rows'))
    sections.push('', '## Rows', '', table(names, labels, rowsRows(result, metrics)));
  return `${[...header, ...sections, ...notes].join('\n')}\n`;
}
