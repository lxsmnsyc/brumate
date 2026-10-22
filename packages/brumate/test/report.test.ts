import { describe, expect, it } from 'vitest';
import { buildReport, formatBuildReport } from '../src/report.ts';
import type { ReportChunk } from '../src/report.ts';
import { routeFiles } from '../src/routes.ts';

/** A chunk whose code does not compress, so its gzip size grows with `size`. */
function chunk(fileName: string, size: number, rest: Partial<ReportChunk> = {}): ReportChunk {
  let code = '';
  for (let index = 0; code.length < size; index++) {
    code += Math.imul(index, 2654435761).toString(36);
  }
  return { fileName, code, isEntry: false, imports: [], moduleIds: [], ...rest };
}

const chunks = [
  chunk('entry.js', 200, {
    isEntry: true,
    imports: ['shared.js'],
    moduleIds: ['/app/src/client.ts'],
  }),
  chunk('shared.js', 100),
  chunk('core.js', 2000, { moduleIds: ['/brumate/dist/runtime/client.js'] }),
  chunk('layout.js', 300, { moduleIds: ['/app/src/routes/_layout.brm?brumate-client'] }),
  chunk('page.js', 300, { moduleIds: ['/app/src/routes/index.brm?brumate-client'] }),
  chunk('page-part.js', 300, { moduleIds: ['/app/src/routes/index.brm?brumate-client&part=0'] }),
  chunk('child.js', 1500, { moduleIds: ['/app/src/Child.brm?brumate-client'] }),
  chunk('about.js', 300, { moduleIds: ['/app/src/routes/about.brm?brumate-client'] }),
];
const sources = new Map([
  ['/app/src/routes/_layout.brm', '<slot />'],
  [
    '/app/src/routes/index.brm',
    "<script>\n  import Child from '../Child.brm';\n</script>\n<Child />",
  ],
  ['/app/src/Child.brm', '<p>Child</p>'],
  ['/app/src/routes/about.brm', '<p>About</p>'],
]);
const routes = {
  tree: routeFiles(['_layout.brm', 'index.brm', 'about.brm']),
  resolve: (file: string) => `/app/src/routes/${file}`,
};

describe('build report', () => {
  it('measures the loader, the core, each component, and each route with what it renders', () => {
    const report = buildReport({ chunks, sources, routes });
    const size = (name: string): number => {
      const one = buildReport({
        chunks: [{ ...chunks.find((item) => item.fileName === name)!, isEntry: true }],
        sources,
      });
      return one.loader;
    };
    expect(report.loader).toBe(size('entry.js') + size('shared.js'));
    expect(report.core).toBe(size('core.js'));
    expect(report.components[0]!.file).toBe('/app/src/Child.brm');
    expect(report.components.find((item) => item.file.endsWith('index.brm'))!.bytes).toBe(
      size('page.js') + size('page-part.js'),
    );
    // The index page renders Child inside the layout, so it can load all three.
    expect(report.routes).toEqual([
      {
        path: '/',
        bytes:
          size('core.js') +
          size('layout.js') +
          size('page.js') +
          size('page-part.js') +
          size('child.js'),
        components: 3,
      },
      {
        path: '/about',
        bytes: size('core.js') + size('layout.js') + size('about.js'),
        components: 2,
      },
    ]);
    expect(report.overBudget).toEqual([]);
    expect(formatBuildReport(report, (file) => file.replace('/app/', ''))).toContain(
      '    src/Child.brm: ',
    );
  });

  it('lists every size over the budget', () => {
    const report = buildReport({ chunks, sources, routes, budget: { loader: 10, route: 1 } });
    expect(report.overBudget).toHaveLength(3);
    expect(report.overBudget[0]).toMatch(/^The loader is \d+ B, over the budget of 10 B\.$/);
    expect(report.overBudget[1]).toMatch(/^The route \/ can load /);
  });

  it('measures what the first run of each handler loads', () => {
    const page = '/app/src/routes/index.brm';
    const withParts = [
      ...chunks.filter((item) => item.fileName !== 'page-part.js'),
      chunk('page-click.js', 300, {
        moduleIds: [`${page}?brumate-client&part=h0`],
        imports: ['chart.js'],
      }),
      chunk('page-update.js', 200, { moduleIds: [`${page}?brumate-client&part=update`] }),
      chunk('page-key.js', 100, { moduleIds: [`${page}?brumate-client&part=h1`] }),
      chunk('chart.js', 1200, {
        moduleIds: ['/app/node_modules/chart/index.js', '/app/src/format.ts'],
        modules: { '/app/node_modules/chart/index.js': 9000, '/app/src/format.ts': 400 },
      }),
    ];
    const size = (name: string): number =>
      buildReport({
        chunks: [{ ...withParts.find((item) => item.fileName === name)!, isEntry: true }],
        sources,
      }).loader;
    const events = [
      { file: page, label: 'event button.click (4:9)', parts: ['h0', 'update'] },
      { file: page, label: 'event input.keydown (5:8)', parts: ['h1'] },
    ];
    const report = buildReport({
      chunks: withParts,
      sources,
      events,
      budget: { event: size('page.js') + size('page-key.js'), component: 1024 },
      relative: (file) => file.replace('/app/', ''),
    });
    // A handler loads the entry of its component, its part, the updates and what they import.
    expect(report.events).toEqual([
      {
        file: page,
        label: 'event button.click (4:9)',
        bytes: size('page.js') + size('page-click.js') + size('page-update.js') + size('chart.js'),
      },
      {
        file: page,
        label: 'event input.keydown (5:8)',
        bytes: size('page.js') + size('page-key.js'),
      },
    ]);
    expect(report.overBudget).toEqual([
      expect.stringMatching(
        /^The component src\/routes\/index\.brm ships [\d.]+ kB, over the budget of 1\.0 kB\.$/,
      ),
      expect.stringMatching(
        /^The handler event button\.click \(4:9\) of src\/routes\/index\.brm loads [\d.]+ kB, over the budget of [\d.]+ (kB|B)\. Its largest imports are node_modules\/chart\/index\.js, src\/format\.ts\.$/,
      ),
    ]);
    expect(formatBuildReport(report, (file) => file.replace('/app/', ''))).toContain(
      '    src/routes/index.brm event button.click (4:9): ',
    );
  });

  it('counts each part as a handler when the build does not name them', () => {
    const report = buildReport({ chunks, sources });
    expect(report.events).toEqual([
      { file: '/app/src/routes/index.brm', label: 'part 0', bytes: expect.any(Number) },
    ]);
  });
});
