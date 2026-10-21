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
});
