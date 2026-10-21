import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hash } from '../src/plan.ts';
import {
  PACKAGE_FORMAT,
  findPackages,
  importSpecifiers,
  packageFileName,
  reachableFiles,
  resolveExports,
  resolvePackageImport,
  splitSpecifier,
} from '../src/packages.ts';
import brumate from '../src/vite.ts';

let base: string;
const write = (file: string, content: string): void => {
  mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
  writeFileSync(path.join(base, file), content);
};
const json = (value: unknown): string => JSON.stringify(value, null, 2);

// A workspace: the app links `@acme/ui`, which depends on `base-kit`, as pnpm links them.
// `plain` has no `brumate` field. `@acme/ui` keeps its test files out with `dir`.
beforeAll(() => {
  base = realpathSync(mkdtempSync(path.join(tmpdir(), 'brumate-packages-')));
  write(
    'app/package.json',
    json({ name: 'app', dependencies: { '@acme/ui': '1.0.0', plain: '1' } }),
  );
  write(
    'app/src/App.brm',
    "<script>\n  import Button from '@acme/ui/Button.brm';\n</script>\n\n<Button />",
  );
  write(
    'ui/package.json',
    json({
      name: '@acme/ui',
      version: '1.0.0',
      brumate: { dir: 'src' },
      exports: {
        '.': './src/index.ts',
        './*.brm': { types: './types/*.d.ts', import: './src/*.brm' },
        './greeting': './src/greeting.ts',
      },
      dependencies: { 'base-kit': '1.0.0' },
    }),
  );
  write(
    'ui/src/Button.brm',
    "<script>\n  import Base from 'base-kit/Base.brm';\n  import { greet } from './greeting.ts';\n</script>\n\n<Base />\n<button onClick=(() => greet())>Greet</button>",
  );
  // Nothing that the app reaches imports it.
  write(
    'ui/src/admin.ts',
    "'use server';\n\nexport async function dropAll() {\n  return 'gone';\n}\n",
  );
  write(
    'ui/src/greeting.ts',
    "'use server';\n\nexport async function greet() {\n  return 'hi';\n}\n",
  );
  write('ui/test/Broken.brm', '<p>{</p>');
  write('base/package.json', json({ name: 'base-kit', version: '1.0.0', brumate: true }));
  write('base/Base.brm', '<p>Base</p>');
  write('plain/package.json', json({ name: 'plain', version: '1.0.0' }));
  mkdirSync(path.join(base, 'app/node_modules/@acme'), { recursive: true });
  mkdirSync(path.join(base, 'ui/node_modules'), { recursive: true });
  symlinkSync(path.join(base, 'ui'), path.join(base, 'app/node_modules/@acme/ui'));
  symlinkSync(path.join(base, 'plain'), path.join(base, 'app/node_modules/plain'));
  symlinkSync(path.join(base, 'base'), path.join(base, 'ui/node_modules/base-kit'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('findPackages', () => {
  it('finds the dependencies that opt in, and theirs, at their real paths', () => {
    const found = findPackages(path.join(base, 'app'));
    expect(found.map((item) => [item.name, item.root, item.directories, item.prefix])).toEqual([
      ['@acme/ui', `${base}/ui`, [`${base}/ui/src`], '@acme/ui'],
      ['base-kit', `${base}/base`, [`${base}/base`], 'base-kit'],
    ]);
    expect(found.every((item) => item.linked)).toBe(true);
  });

  it('refuses a package whose field has another version', () => {
    write('old-app/package.json', json({ name: 'old-app', dependencies: { future: '1' } }));
    write(
      'old-app/node_modules/future/package.json',
      json({ name: 'future', brumate: { version: PACKAGE_FORMAT + 1 } }),
    );
    expect(() => findPackages(path.join(base, 'old-app'))).toThrow(
      `The package future has "brumate": { "version": ${PACKAGE_FORMAT + 1} }`,
    );
  });

  it('names a file of a package by the package, not by where it is installed', () => {
    const [ui] = findPackages(path.join(base, 'app'));
    expect(packageFileName(ui!, `${base}/ui/src/Button.brm`)).toBe('@acme/ui/src/Button.brm');
  });
});

const read = (file: string): string | undefined => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

describe('reachableFiles', () => {
  it('follows imports from the app into packages, and between packages', () => {
    const packages = findPackages(path.join(base, 'app'));
    const reached = reachableFiles(packages, [`${base}/app/src/App.brm`], read);
    expect([...reached].toSorted()).toEqual([
      `${base}/base/Base.brm`,
      `${base}/ui/src/Button.brm`,
      `${base}/ui/src/greeting.ts`,
    ]);
  });

  it('finds the specifiers of imports, exports and dynamic imports', () => {
    expect(
      importSpecifiers(
        "import a from './a.brm';\nimport { b } from \"b\";\nexport * from './c.ts';\nimport('./d.ts');\nimport './e.css';",
      ),
    ).toEqual(['./a.brm', 'b', './c.ts', './d.ts', './e.css']);
  });
});

describe('resolvePackageImport', () => {
  it('splits bare specifiers', () => {
    expect(splitSpecifier('@acme/ui/Button.brm')).toEqual({
      name: '@acme/ui',
      subpath: './Button.brm',
    });
    expect(splitSpecifier('kit')).toEqual({ name: 'kit', subpath: '.' });
    expect(splitSpecifier('./Button.brm')).toBeUndefined();
    expect(splitSpecifier('node:fs')).toBeUndefined();
  });

  it('resolves through exports, with patterns and conditions', () => {
    const exports = {
      '.': './index.js',
      './*.brm': { types: './types/*.d.ts', import: './src/*.brm' },
      './icons/*.brm': './icons/*.brm',
      './hidden': null,
    };
    expect(resolveExports(exports, '.')).toBe('./index.js');
    expect(resolveExports(exports, './Button.brm')).toBe('./src/Button.brm');
    // The longest prefix wins.
    expect(resolveExports(exports, './icons/Star.brm')).toBe('./icons/Star.brm');
    expect(resolveExports(exports, './hidden')).toBeUndefined();
    expect(resolveExports(exports, './other.ts')).toBeUndefined();
    expect(resolveExports('./main.js', '.')).toBe('./main.js');
  });

  it('resolves a specifier from an importer to the real file', () => {
    const importer = `${base}/app/src/App.brm`;
    expect(resolvePackageImport('@acme/ui/Button.brm', importer)).toBe(`${base}/ui/src/Button.brm`);
    expect(resolvePackageImport('@acme/ui/greeting', importer)).toBe(`${base}/ui/src/greeting.ts`);
    expect(resolvePackageImport('@acme/ui/Missing.brm', importer)).toBeUndefined();
    // A package without exports resolves the path in it.
    expect(resolvePackageImport('base-kit/Base.brm', `${base}/ui/src/Button.brm`)).toBe(
      `${base}/base/Base.brm`,
    );
    expect(resolvePackageImport('nothing/x.brm', importer)).toBeUndefined();
  });
});

describe('vite plugin with packages', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      root: path.join(base, 'app'),
      configFile: false,
      logLevel: 'silent',
      plugins: [brumate()],
      appType: 'custom',
      server: { middlewareMode: true, watch: null },
    });
    await server.pluginContainer.buildStart({});
  });

  afterAll(async () => {
    await server.close();
  });

  it('keeps packages out of the dep optimizer and in the server build', () => {
    expect(server.config.optimizeDeps.exclude).toEqual(
      expect.arrayContaining(['@acme/ui', 'base-kit']),
    );
    expect(server.config.ssr.noExternal).toEqual(expect.arrayContaining(['@acme/ui', 'base-kit']));
  });

  it('lists the components of packages under IDs from the package name', async () => {
    const manifest = await server.transformRequest('virtual:brumate/manifest');
    const code = manifest?.code ?? '';
    expect(code).toContain(`"App_${hash('src/App.brm')}"`);
    expect(code).toContain(`"Button_${hash('@acme/ui/src/Button.brm')}"`);
    expect(code).toContain(`"Base_${hash('base-kit/Base.brm')}"`);
    // `dir` keeps the test files of the package out.
    expect(code).not.toContain('Broken');
  });

  it('registers the server functions of packages that the app reaches', async () => {
    const registry = await server.transformRequest('virtual:brumate/server', { ssr: true });
    expect(registry?.code).toContain(`"greeting_${hash('@acme/ui/src/greeting.ts')}#greet"`);
    // A 'use server' file of a package that the app does not import is no endpoint.
    expect(registry?.code).not.toContain('admin');
  });
});
