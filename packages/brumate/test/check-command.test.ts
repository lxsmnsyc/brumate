import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { check, errorCount, formatRecord, parseTypeOutput } from '../src/check-command.ts';
import type { CheckRecord } from '../src/check-command.ts';
import { compile } from '../src/index.ts';
import { ERRORS, errorLink, findError, renderErrorsPage } from '../src/error-catalog.ts';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const CODES = fileURLToPath(new URL('./error-codes.json', import.meta.url));
const PAGE = fileURLToPath(new URL('../../../website/docs/errors.md', import.meta.url));

const roots: string[] = [];
function files(records: CheckRecord[]): (string | null)[] {
  const result: (string | null)[] = [];
  for (const record of records) {
    result.push(record.file);
  }
  return result;
}
function lines(text: string): string[] {
  const result: string[] = [];
  for (const line of text.split('\n')) {
    if (line) {
      result.push(line);
    }
  }
  return result;
}

function project(sources: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'brumate-check-'));
  roots.push(root);
  for (const [name, source] of Object.entries(sources)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), source);
  }
  return root;
}
afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const IMPORT = "import { $memo, $signal } from 'brumate/signals';";
const GOOD = `<script>\n  ${IMPORT}\n  let count = $signal(0);\n</script>\n<p>{count}</p>\n`;
// \`double\` is a memo, so assigning to it is a compile error.
const WRONG = `<script>\n  ${IMPORT}\n  let count = $signal(0);\n  const double = $memo(count * 2);\n  double = 1;\n</script>\n<p>{double}</p>\n`;
const SYNTAX = '<div>\n  <p>Text</p>\n';

describe('codes', () => {
  it('gives every entry a unique code of the form BRMnnn', () => {
    const seen = new Set<string>();
    for (const entry of ERRORS) {
      expect(entry.code).toMatch(/^BRM\d{3}$/);
      expect(seen.has(entry.code!)).toBe(false);
      seen.add(entry.code!);
      expect(entry.link).toBe(errorLink(entry.code!));
    }
  });

  it('pins each code to its message in test/error-codes.json', () => {
    const pinned = JSON.parse(readFileSync(CODES, 'utf8')) as Record<string, string>;
    if (process.env.UPDATE_SKILL) {
      // A new code is added. A code that is there never changes.
      for (const entry of ERRORS) {
        pinned[entry.code!] ??= entry.message;
      }
      const sorted: Record<string, string> = {};
      for (const code of Object.keys(pinned).toSorted()) {
        sorted[code] = pinned[code]!;
      }
      writeFileSync(CODES, `${JSON.stringify(sorted, null, 2)}\n`);
      return;
    }
    // A changed code or a reused code shows as a different message for a code. A new entry
    // needs its code in the file, so a code that was removed is never given again.
    for (const entry of ERRORS) {
      expect(pinned[entry.code!], `${entry.code} is not pinned to this message`).toBe(
        entry.message,
      );
    }
  });

  it('adds the code to the message of a syntax error and of a compile error', () => {
    const syntax = findError('Unexpected closing tag')!;
    expect(() => compile('</p>', { filename: 'A.brm' })).toThrow(
      `Unexpected closing tag [${syntax.code}] (A.brm:1:1)`,
    );
    expect(() => compile(WRONG, { filename: 'A.brm' })).toThrow(/\[BRM\d{3}\] \(A\.brm:5:3\)/);
  });

  it('finds the entry of a message that has a code', () => {
    const entry = findError('Unexpected closing tag')!;
    expect(findError(`Unexpected closing tag [${entry.code}] (A.brm:1:1)`)).toBe(entry);
  });

  it('keeps website/docs/errors.md as the catalog renders it', () => {
    if (process.env.UPDATE_SKILL) {
      writeFileSync(PAGE, renderErrorsPage());
    }
    expect(readFileSync(PAGE, 'utf8')).toBe(renderErrorsPage());
  });

  it('links each code to an anchor of that page', () => {
    const page = readFileSync(PAGE, 'utf8');
    for (const entry of ERRORS) {
      expect(page).toContain(`\n## ${entry.code}\n`);
      expect(entry.link).toBe(
        `https://brumate-docs.vercel.app/docs/errors#${entry.code!.toLowerCase()}`,
      );
    }
  });
});

describe('check', () => {
  it('prints no record for a project without problems', async () => {
    const root = project({ 'A.brm': GOOD });
    expect((await check(root, { types: false })).records).toEqual([]);
  });

  it('reports a compile error with its range, code and link', async () => {
    const root = project({ 'src/A.brm': WRONG, 'src/B.brm': GOOD });
    const { records } = await check(root, { types: false });
    expect(records).toHaveLength(1);
    const [record] = records as [CheckRecord];
    expect(record.file).toBe('src/A.brm');
    expect(record.severity).toBe('error');
    expect(record.range!.start).toEqual({ line: 5, column: 3 });
    expect(record.range!.end.line).toBe(5);
    expect(record.code).toMatch(/^BRM\d{3}$/);
    expect(record.link).toBe(errorLink(record.code!));
    expect(record.message).toBe('Cannot assign to memo "double"');
    expect(record.source).toBe('brumate');
  });

  it('reports a syntax error with its code', async () => {
    const root = project({ 'A.brm': SYNTAX });
    const { records } = await check(root, { types: false });
    expect(records).toHaveLength(1);
    expect(records[0]!.message).toBe('Unexpected end of file, expected a closing tag');
    expect(records[0]!.code).toBe(findError(records[0]!.message)!.code);
    expect(records[0]!.range!.start.line).toBeGreaterThan(0);
  });

  it('reports every file, and limits the files to the paths', async () => {
    const root = project({ 'A.brm': SYNTAX, 'B.brm': WRONG, 'C.brm': GOOD });
    expect(files((await check(root, { types: false })).records)).toEqual(['A.brm', 'B.brm']);
    expect(files((await check(root, { types: false, paths: ['B.brm'] })).records)).toEqual([
      'B.brm',
    ]);
  });

  it('reports a warning without a code, and a warning is not an error', async () => {
    const root = project({
      'A.brm': `<script>\n  ${IMPORT}\n  let count = $signal(0);\n</script>\n<img src="a.png">\n`,
    });
    const { records } = await check(root, { types: false });
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.severity).toBe('warning');
      expect(record.code).toBeNull();
    }
  });

  it('reports a path that does not exist, and still checks the others', async () => {
    const root = project({ 'A.brm': WRONG });
    const { records } = await check(root, { types: false, paths: ['nope.brm', 'A.brm'] });
    expect(records[0]).toMatchObject({
      file: 'nope.brm',
      severity: 'error',
      message: 'This file or directory does not exist',
    });
    expect(records).toHaveLength(2);
    const only = await check(root, { types: false, paths: ['nope.brm'] });
    expect(errorCount(only.records)).toBe(1);
  });

  it('keeps a range at the end of the file inside the file', async () => {
    const root = project({ 'A.brm': '<p>{count' });
    const { records } = await check(root, { types: false });
    const end = records[0]!.range!.end;
    expect(end.line).toBe(1);
    expect(end.column).toBeLessThanOrEqual('<p>{count'.length + 1);
  });

  it('formats a record as a line', () => {
    expect(
      formatRecord({
        file: 'A.brm',
        range: { start: { line: 5, column: 3 }, end: { line: 4, column: 4 } },
        severity: 'error',
        message: 'Unexpected closing tag',
        code: 'BRM009',
        link: 'https://brumate-docs.vercel.app/docs/errors#brm009',
        source: 'brumate',
      }),
    ).toBe(
      'A.brm:5:3: error BRM009: Unexpected closing tag\n  https://brumate-docs.vercel.app/docs/errors#brm009',
    );
  });
});

const TSC_BIN = fileURLToPath(new URL('../../tsc/bin/brumate-tsc.js', import.meta.url));
const TSC_BUILT = existsSync(fileURLToPath(new URL('../../tsc/dist/index.js', import.meta.url)));
const FIXTURE = fileURLToPath(new URL('../../tsc/test/fixture', import.meta.url));

// The type checker needs the build of @brumate/tsc, like the tests of that package.
describe.skipIf(!TSC_BUILT)('type check', () => {
  it('reports type errors of .brm files with the other problems', async () => {
    const { records } = await check(FIXTURE, { tscBin: TSC_BIN });
    const types: CheckRecord[] = [];
    let first: CheckRecord | undefined;
    for (const record of records) {
      if (record.source === 'typescript') {
        types.push(record);
        if (record.file === 'src/App.brm' && record.code === 'TS2322') {
          first ??= record;
        }
      }
    }
    expect(types.length).toBeGreaterThan(5);
    expect(first!.range!.start).toEqual({ line: 9, column: 19 });
    expect(first!.message).toBe("Type 'string' is not assignable to type 'number'.");
    expect(first!.severity).toBe('error');
  }, 60_000);
});

describe('a type check that fails', () => {
  function typed(script: string): ReturnType<typeof check> {
    const root = project({ 'A.brm': GOOD, 'tsconfig.json': '{}', 'tsc.js': script });
    return check(root, { tscBin: join(root, 'tsc.js') });
  }

  it('is an error when the process is killed', async () => {
    const { records } = await typed("process.kill(process.pid, 'SIGKILL');");
    expect(errorCount(records)).toBe(1);
    expect(records[0]!.message).toContain('SIGKILL');
  });

  it('is an error when it ends with a status and prints nothing', async () => {
    const { records } = await typed('process.exitCode = 3;');
    expect(errorCount(records)).toBe(1);
    expect(records[0]!.message).toContain('status 3');
  });

  it('is an error when it prints more than the buffer holds', async () => {
    const { records } = await typed("process.stdout.write('x'.repeat(70 * 1024 * 1024));");
    expect(errorCount(records)).toBe(1);
    expect(records[0]!.message).toContain('did not finish');
  });
});

describe('type output', () => {
  it('reads the lines of the type checker', () => {
    const output = [
      "src/App.brm(9,19): error TS2322: Type 'string' is not assignable to type 'number'.",
      '  The types of the property are not compatible.',
      'src/App.brm(2,1): error BRM: Unexpected closing tag',
      "error TS5057: Cannot find a tsconfig.json file at 'x'.",
      '',
    ].join('\n');
    const records = parseTypeOutput(output, '/project');
    expect(records).toEqual([
      {
        file: 'src/App.brm',
        range: { start: { line: 9, column: 19 }, end: { line: 9, column: 19 } },
        severity: 'error',
        message:
          "Type 'string' is not assignable to type 'number'.\n  The types of the property are not compatible.",
        code: 'TS2322',
        link: null,
        source: 'typescript',
      },
      {
        file: null,
        range: null,
        severity: 'error',
        message: "Cannot find a tsconfig.json file at 'x'.",
        code: 'TS5057',
        link: null,
        source: 'typescript',
      },
    ]);
  });
});

describe('brumate check', () => {
  function run(
    root: string,
    ...args: string[]
  ): { status: number | null; out: string[]; err: string } {
    const result = spawnSync(process.execPath, [CLI, 'check', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    return {
      status: result.status,
      out: lines(result.stdout),
      err: result.stderr,
    };
  }

  it('prints one JSON record for each problem and exits with 1', () => {
    const root = project({ 'A.brm': WRONG, 'B.brm': SYNTAX });
    const { status, out } = run(root, '--json', '--no-types');
    expect(status).toBe(1);
    const records: CheckRecord[] = [];
    for (const line of out) {
      records.push(JSON.parse(line) as CheckRecord);
    }
    expect(files(records)).toEqual(['A.brm', 'B.brm']);
    for (const record of records) {
      expect(record.code).toMatch(/^BRM\d{3}$/);
      expect(record.link).toMatch(/^https:\/\/brumate-docs\.vercel\.app\/docs\/errors#brm\d{3}$/);
      expect(record.range!.start.line).toBeGreaterThan(0);
    }
  });

  it('prints readable lines without --json', () => {
    const root = project({ 'A.brm': WRONG });
    const { status, out } = run(root, '--no-types');
    expect(status).toBe(1);
    expect(out[0]).toMatch(/^A\.brm:5:3: error BRM\d{3}: /);
    expect(out.at(-1)).toBe('1 error.');
  });

  it('exits with 0 when there is no error', () => {
    const root = project({ 'A.brm': GOOD });
    const { status, out } = run(root, '--no-types');
    expect(status).toBe(0);
    expect(out).toEqual(['No errors.']);
  });

  it('says so when the type check cannot run', () => {
    const root = project({ 'A.brm': GOOD });
    const { status, err } = run(root, '--json');
    expect(status).toBe(0);
    expect(err).toContain('tsconfig.json');
  });

  it('exits with 1 for a path that does not exist, without a stack', () => {
    const { status, err, out } = run(project({ 'A.brm': GOOD }), '--no-types', 'nope.brm');
    expect(status).toBe(1);
    expect(err).not.toContain('ENOENT');
    expect(out[0]).toContain('nope.brm: error: This file or directory does not exist');
  });

  it('rejects an unknown flag', () => {
    expect(run(project({}), '--nope').status).toBe(1);
  });
});

describe('server imports', () => {
  it('finds a handler that reads a memo of a function from a use server file', async () => {
    const root = project({
      'src/issues.ts': "'use server';\nexport async function listIssues() {\n  return [];\n}\n",
      'src/Issues.brm': `<script>\n  import { $memo } from 'brumate/signals';\n  import { listIssues } from './issues.ts';\n  const issues = $memo(listIssues());\n  function count() {\n    console.log(issues.length);\n  }\n</script>\n<button onClick=count>Count</button>\n`,
    });
    const { records } = await check(root, { types: false });
    const codes: (string | null)[] = [];
    for (const record of records) {
      codes.push(record.code);
    }
    expect(codes).toContain('BRM182');
  });
});

const USER = (specifier: string): string =>
  `<script>\n  import { counter } from '${specifier}';\n  const { count } = counter(1);\n</script>\n<p>{count}</p>\n`;

async function checkCodes(sources: Record<string, string>): Promise<(string | null)[]> {
  const { records } = await check(project(sources), { types: false });
  const result: (string | null)[] = [];
  for (const record of records) {
    result.push(record.code);
  }
  return result;
}

describe('package imports', () => {
  const MODULE = `import { $signal } from 'brumate/signals';\n\nexport function counter(start: number) {\n  let count = $signal(start);\n  return { count };\n}\n`;
  const PACKAGE = {
    'package.json': '{"name":"app","dependencies":{"@acme/ui":"1.0.0"}}',
    'node_modules/@acme/ui/package.json':
      '{"name":"@acme/ui","version":"1.0.0","brumate":true,"exports":{"./counter.brm.ts":"./counter.brm.ts"}}',
    'node_modules/@acme/ui/counter.brm.ts': MODULE,
  };

  it('reads a module of reactive logic from a package of components', async () => {
    expect(await checkCodes({ ...PACKAGE, 'A.brm': USER('@acme/ui/counter.brm.ts') })).toEqual([]);
  });

  it('still reports a module that no package has', async () => {
    expect(await checkCodes({ ...PACKAGE, 'A.brm': USER('@acme/ui/missing.brm.ts') })).toEqual([
      'BRM167',
    ]);
  });

  it('does not read a package that has no brumate field', async () => {
    expect(
      await checkCodes({
        ...PACKAGE,
        'node_modules/@acme/ui/package.json':
          '{"name":"@acme/ui","version":"1.0.0","exports":{"./counter.brm.ts":"./counter.brm.ts"}}',
        'A.brm': USER('@acme/ui/counter.brm.ts'),
      }),
    ).toEqual(['BRM167']);
  });

  it('finds a use server file of a package', async () => {
    const found = await checkCodes({
      ...PACKAGE,
      'node_modules/@acme/ui/package.json':
        '{"name":"@acme/ui","version":"1.0.0","brumate":true,"exports":{"./issues.ts":"./issues.ts"}}',
      'node_modules/@acme/ui/issues.ts':
        "'use server';\nexport async function listIssues() {\n  return [];\n}\n",
      'src/Issues.brm': `<script>\n  import { $memo } from 'brumate/signals';\n  import { listIssues } from '@acme/ui/issues.ts';\n  const issues = $memo(listIssues());\n  function count() {\n    console.log(issues.length);\n  }\n</script>\n<button onClick=count>Count</button>\n`,
    });
    expect(found).toContain('BRM182');
  });
});
