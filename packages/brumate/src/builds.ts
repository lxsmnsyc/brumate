// The builds of the client, for skew protection. Each build has an ID, which
// the client build writes to `.brumate/build.json` and the server build
// reads. `.brumate/builds.json` lists the last builds with their files, so
// the files of earlier builds can stay for the pages that are still open,
// and go when they are old enough.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The file in the client build that names its build. */
export const BUILD_FILE = '.brumate/build.json';
/** The file in the client build that lists the builds whose files are in it. */
export const BUILDS_FILE = '.brumate/builds.json';

interface BuildEntry {
  id: string;
  /** When the build ran, as milliseconds since the epoch. */
  at: number;
  /** The files that the build wrote, relative to the output directory. */
  files: string[];
}

/** The directory of the client build, from the root and the prerender options. */
export function clientBuildDirectory(
  root: string,
  prerender: boolean | { client?: string } | undefined,
): string {
  const client = typeof prerender === 'object' ? prerender.client : undefined;
  return path.resolve(root, client ?? 'dist/client');
}

/** The ID of the build in a client build directory, or undefined without one. */
export function readBuildId(directory: string): string | undefined {
  const file = path.join(directory, BUILD_FILE);
  if (!existsSync(file)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { build?: unknown };
    return typeof parsed.build === 'string' ? parsed.build : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the ID of a build to its client output, adds the build to the list
 * of builds, and removes the files of builds older than the `keep` builds
 * before this one, unless a kept build wrote the same file. Returns the IDs
 * of the builds whose files went.
 */
export function pruneBuilds(
  directory: string,
  id: string,
  files: string[],
  keep: number,
  now: number = Date.now(),
): string[] {
  const list = path.join(directory, BUILDS_FILE);
  let builds: BuildEntry[] = [];
  if (existsSync(list)) {
    try {
      builds = (JSON.parse(readFileSync(list, 'utf8')) as { builds?: BuildEntry[] }).builds ?? [];
    } catch {
      builds = [];
    }
  }
  builds = builds.filter((build) => build.id !== id);
  builds.push({ id, at: now, files });
  builds.sort((a, b) => a.at - b.at);
  const kept = builds.slice(Math.max(0, builds.length - 1 - keep));
  const dropped = builds.slice(0, builds.length - kept.length);
  const keptFiles = new Set(kept.flatMap((build) => build.files));
  for (const build of dropped) {
    for (const file of build.files) {
      if (!keptFiles.has(file)) {
        rmSync(path.join(directory, file), { force: true });
      }
    }
  }
  mkdirSync(path.join(directory, '.brumate'), { recursive: true });
  writeFileSync(path.join(directory, BUILD_FILE), `${JSON.stringify({ build: id })}\n`);
  writeFileSync(list, `${JSON.stringify({ builds: kept }, null, 2)}\n`);
  return dropped.map((build) => build.id);
}
