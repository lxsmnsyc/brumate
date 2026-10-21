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

export function markdown(result, metrics) {
  const names = result.options.frameworks;
  const fw = result.frameworks;
  const labels = Object.fromEntries(names.map((name) => [name, fw[name].label]));
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
    `- Took ${result.durationSeconds} s`,
  ].filter((line) => line !== undefined);
  const notes = result.notes.length
    ? ['', '## Notes', '', ...result.notes.map((note) => `- ${note}`)]
    : [];
  return `${[...header, '', table(names, labels, rows), ...notes].join('\n')}\n`;
}
