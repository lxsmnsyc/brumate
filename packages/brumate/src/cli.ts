#!/usr/bin/env node
import { cp, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, errorCount, formatRecord } from './check-command.ts';
import { CompileError } from './compile.ts';
import { defaultExclude, findFiles } from './files.ts';
import { inspect } from './inspect.ts';
import type { InspectReport } from './inspect.ts';
import { analyzeProjectProps } from './project.ts';

const USAGE = `Usage: brumate inspect [--json] [files or directories]

Shows what each component ships to the client, and why.
Without paths, inspects every .brm file under the current directory.

       brumate check [--json] [--no-types] [files or directories]

Compiles every .brm file and type-checks the project with brumate-tsc.
Prints each problem with its place, its code and a link to the docs.
With --json, prints one JSON object per line. Exits with 1 on an error.

       brumate skill [folder]

Copies the skill for .brm files into folder/brumate, for coding agents.
The folder defaults to .claude/skills.`;

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

/** Shows parent files relative to the current directory. */
function relativeParents(
  parents: Map<string, Set<string>>,
  root: string,
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [prop, files] of parents) {
    result.set(prop, new Set([...files].map((file) => toPosix(path.relative(root, file)))));
  }
  return result;
}

async function inspectCommand(args: string[]): Promise<number> {
  const json = args.includes('--json');
  const paths = args.filter((arg) => arg !== '--json');
  const root = process.cwd();

  // Props are analyzed across every file under the current directory.
  const project = await findFiles(root, defaultExclude);
  const sources = new Map<string, string>();
  for (const [index, source] of (
    await Promise.all(project.map((file) => readFile(file, 'utf8')))
  ).entries()) {
    sources.set(project[index]!, source);
  }
  const props = analyzeProjectProps(sources);

  const found = await Promise.all(
    (paths.length > 0 ? paths : ['.']).map(async (target) => {
      const absolute = path.resolve(root, target);
      return (await stat(absolute)).isDirectory()
        ? findFiles(absolute, defaultExclude)
        : [toPosix(absolute)];
    }),
  );
  const targets = found.flat();
  // Files outside the current directory are read here.
  const extra = targets.filter((file) => !sources.has(file));
  for (const [index, source] of (
    await Promise.all(extra.map((file) => readFile(file, 'utf8')))
  ).entries()) {
    sources.set(extra[index]!, source);
  }

  const reports: InspectReport[] = [];
  const texts: string[] = [];
  let failed = false;
  for (const file of targets) {
    const source = sources.get(file)!;
    const filename = toPosix(path.relative(root, file));
    try {
      const parents = props.get(file);
      const result = inspect(source, {
        filename,
        liveProps: parents && new Set(parents.keys()),
        parents: parents && relativeParents(parents, root),
      });
      reports.push(result.report);
      texts.push(result.text);
    } catch (error) {
      if (!(error instanceof CompileError)) {
        throw error;
      }
      failed = true;
      console.error(error.message);
    }
  }
  console.log(json ? JSON.stringify(reports, null, 2) : texts.join('\n\n'));
  return failed ? 1 : 0;
}

async function checkCommand(args: string[]): Promise<number> {
  const flags = new Set(['--json', '--no-types']);
  const paths: string[] = [];
  for (const arg of args) {
    if (!arg.startsWith('-')) {
      paths.push(arg);
    } else if (!flags.has(arg)) {
      console.error(`brumate check does not know ${arg}\n\n${USAGE}`);
      return 1;
    }
  }
  const { records, notes } = await check(process.cwd(), {
    paths,
    types: !args.includes('--no-types'),
  });
  const json = args.includes('--json');
  for (const record of records) {
    console.log(json ? JSON.stringify(record) : formatRecord(record));
  }
  for (const note of notes) {
    console.error(note);
  }
  const errors = errorCount(records);
  if (!json) {
    console.log(errors === 0 ? 'No errors.' : `${errors} ${errors === 1 ? 'error' : 'errors'}.`);
  }
  return errors === 0 ? 0 : 1;
}

async function skillCommand(args: string[]): Promise<number> {
  if (args.length > 1 || args[0]?.startsWith('-')) {
    console.error(`brumate skill takes one folder, not ${args.join(' ')}\n\n${USAGE}`);
    return 1;
  }
  const folder = path.resolve(args[0] ?? '.claude/skills');
  const target = path.join(folder, 'brumate');
  // The skill is in the package, next to dist and src.
  const source = fileURLToPath(new URL('../skills/brumate', import.meta.url));
  await cp(source, target, { recursive: true, force: true });
  console.log(`Copied the skill to ${path.relative(process.cwd(), target) || '.'}`);
  return 0;
}

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === 'skill') {
    return skillCommand(rest);
  }
  if (command === 'check') {
    return checkCommand(rest);
  }
  if (command === 'inspect') {
    return inspectCommand(rest);
  }
  console.log(USAGE);
  return command === undefined || command === '--help' ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
