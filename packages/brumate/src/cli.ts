#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { CompileError } from './compile.ts';
import { defaultExclude, findFiles } from './files.ts';
import { inspect } from './inspect.ts';
import type { InspectReport } from './inspect.ts';
import { analyzeProjectProps } from './project.ts';

const USAGE = `Usage: brumate inspect [--json] [files or directories]

Shows what each component ships to the client, and why.
Without paths, inspects every .brm file under the current directory.`;

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

async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === 'inspect') {
    return inspectCommand(rest);
  }
  console.log(USAGE);
  return command === undefined || command === '--help' ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
