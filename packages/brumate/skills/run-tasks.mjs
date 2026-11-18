#!/usr/bin/env node
// Grades the tasks of skills/tasks. It runs by hand before a release, not in CI, and calls no model.
//
//   node packages/brumate/skills/run-tasks.mjs [task ...] [--project dir] [--answers dir] [--reference] [--json]
//
// An agent does a task with the skill, in a copy of a project that has brumate, @brumate/ui,
// vitest and happy-dom. Its files for a task are in `<answers>/<task>/src`. The grader copies them
// to a scratch folder next to the project, then reports three checks for each task:
//   1. compile: `brumate check --no-types --json` finds no error;
//   2. types: `brumate check --json` finds no error of TypeScript;
//   3. test: the test of the task passes (Vitest with the brumate plugin, in happy-dom).
// `--reference` grades the solution of each task instead, to check the grader and the tasks.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tasksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tasks');

function parseArgs(argv) {
  const options = {
    project: process.cwd(),
    answers: undefined,
    reference: false,
    json: false,
    ids: [],
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--project') {
      options.project = path.resolve(argv[++index] ?? '');
    } else if (argument === '--answers') {
      options.answers = path.resolve(argv[++index] ?? '');
    } else if (argument === '--reference') {
      options.reference = true;
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option ${argument}`);
    } else {
      options.ids.push(argument);
    }
  }
  options.answers ??= path.join(options.project, '.tasks', 'answers');
  return options;
}

function listTasks() {
  return readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

// The bin of a package of the project, found from the project's own node_modules.
function findBin(project, specifier, bin) {
  const require = createRequire(path.join(project, 'package.json'));
  return path.join(path.dirname(require.resolve(`${specifier}/package.json`)), bin);
}

function run(command, args, cwd) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240_000,
  });
  return { status: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

// The records that `brumate check --json` printed, one JSON object a line.
function readRecords(out) {
  const records = [];
  for (const line of out.split('\n')) {
    if (line.startsWith('{')) {
      try {
        records.push(JSON.parse(line));
      } catch {
        // A line that is not a record is a note of the command.
      }
    }
  }
  return records;
}

function describe(record) {
  const place = record.file ? `${record.file}:${record.range?.start.line ?? 1} ` : '';
  return `${place}${record.code ?? ''} ${record.message}`.trim();
}

function prepare(project, id, answerSrc) {
  const scratch = path.join(project, '.tasks', 'run', id);
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  cpSync(answerSrc, path.join(scratch, 'src'), { recursive: true });
  cpSync(path.join(tasksDir, id, 'test.ts'), path.join(scratch, 'task.test.ts'));
  writeFileSync(
    path.join(scratch, 'vitest.config.ts'),
    [
      "import brumate from 'brumate/vite';",
      "import { defineConfig } from 'vitest/config';",
      '',
      "export default defineConfig({ plugins: [brumate()], test: { environment: 'happy-dom' } });",
      '',
    ].join('\n'),
  );
  const tsconfig = {
    compilerOptions: {
      target: 'es2023',
      lib: ['es2023', 'dom'],
      module: 'preserve',
      moduleResolution: 'bundler',
      types: ['vite/client', 'brumate/types'],
      strict: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      noEmit: true,
    },
    include: ['src'],
  };
  writeFileSync(path.join(scratch, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  return scratch;
}

function gradeTask(project, id, answerSrc) {
  const checks = [];
  if (!existsSync(answerSrc)) {
    return [{ name: 'files', ok: false, detail: [`There is no folder ${answerSrc}`] }];
  }
  const scratch = prepare(project, id, answerSrc);
  const brumate = findBin(project, 'brumate', 'dist/cli.js');

  // 1. Compile every .brm file, with no type check.
  const compiled = run(brumate, ['check', '--no-types', '--json', 'src'], scratch);
  const compileErrors = readRecords(compiled.out).filter((record) => record.severity === 'error');
  checks.push({
    name: 'compile',
    ok: compiled.status === 0 && compileErrors.length === 0,
    detail:
      compileErrors.length > 0 ? compileErrors.map(describe) : tail(compiled, compiled.status),
  });

  // 2. The type check.
  const typed = run(brumate, ['check', '--json', 'src'], scratch);
  const typeErrors = readRecords(typed.out).filter((record) => record.severity === 'error');
  checks.push({
    name: 'types',
    ok: typed.status === 0 && typeErrors.length === 0,
    detail: typeErrors.length > 0 ? typeErrors.map(describe) : tail(typed, typed.status),
  });

  // 3. The test of the task.
  const vitest = findBin(project, 'vitest', 'vitest.mjs');
  const tested = run(vitest, ['run', '--root', scratch, '--config', 'vitest.config.ts'], scratch);
  checks.push({
    name: 'test',
    ok: tested.status === 0,
    detail: tested.status === 0 ? [] : tested.out.trim().split('\n').slice(-25),
  });
  return checks;
}

// The last lines of a failed run that printed no record.
function tail(result, status) {
  return status === 0 ? [] : result.out.trim().split('\n').slice(-8);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const all = listTasks();
  const ids = options.ids.length > 0 ? options.ids : all;
  for (const id of ids) {
    if (!all.includes(id)) {
      throw new Error(`There is no task ${id}. Tasks: ${all.join(', ')}`);
    }
  }
  const results = [];
  for (const id of ids) {
    const answerSrc = options.reference
      ? path.join(tasksDir, id, 'solution', 'src')
      : path.join(options.answers, id, 'src');
    results.push({ task: id, checks: gradeTask(options.project, id, answerSrc) });
  }
  rmSync(path.join(options.project, '.tasks', 'run'), { recursive: true, force: true });

  const failed = results.filter((result) => result.checks.some((check) => !check.ok));
  if (options.json) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  } else {
    for (const result of results) {
      const ok = result.checks.every((check) => check.ok);
      console.log(`${ok ? 'PASS' : 'FAIL'} ${result.task}`);
      for (const check of result.checks) {
        console.log(`  ${check.ok ? 'ok  ' : 'FAIL'} ${check.name}`);
        for (const line of check.detail) {
          console.log(`       ${line}`);
        }
      }
    }
    console.log(`${results.length - failed.length}/${results.length} tasks pass`);
  }
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main();
