import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { check, formatRecord, parseTypeOutput } from '../src/check-command.ts';
import type { CheckRecord } from '../src/check-command.ts';
import { compile } from '../src/index.ts';
import { ERRORS, errorLink, findError, renderErrorsPage } from '../src/error-catalog.ts';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
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
  it('gives every entry a unique code of the form BRMnnn, in the order of the catalog', () => {
    const seen = new Set<string>();
    let last = 0;
    for (const entry of ERRORS) {
      expect(entry.code).toMatch(/^BRM\d{3}$/);
      expect(seen.has(entry.code!)).toBe(false);
      seen.add(entry.code!);
      const number = Number(entry.code!.slice(3));
      expect(number).toBeGreaterThan(last);
      last = number;
      expect(entry.link).toBe(errorLink(entry.code!));
    }
  });

  it('keeps the codes that were assigned first', () => {
    expect(ERRORS[0]!.code).toBe('BRM001');
    expect(ERRORS[0]!.message).toBe('Unterminated comment');
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
      expect(entry.link).toBe(`https://brumate.dev/docs/errors#${entry.code!.toLowerCase()}`);
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

  it('formats a record as a line', () => {
    expect(
      formatRecord({
        file: 'A.brm',
        range: { start: { line: 5, column: 3 }, end: { line: 4, column: 4 } },
        severity: 'error',
        message: 'Unexpected closing tag',
        code: 'BRM009',
        link: 'https://brumate.dev/docs/errors#brm009',
        source: 'brumate',
      }),
    ).toBe(
      'A.brm:5:3: error BRM009: Unexpected closing tag\n  https://brumate.dev/docs/errors#brm009',
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
          "Type 'string' is not assignable to type 'number'.\nThe types of the property are not compatible.",
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
      expect(record.link).toMatch(/^https:\/\/brumate\.dev\/docs\/errors#brm\d{3}$/);
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

  it('rejects an unknown flag', () => {
    expect(run(project({}), '--nope').status).toBe(1);
  });
});
