// Smoke tests in Chrome: builds the website and examples, serves each one,
// and uses it as a person would. See README.md.
//
//   pnpm e2e [--only website,todos,tracker,nitro,kit] [--no-build] [--headed] [--install-browser]
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
// The benchmarks find Chrome the same way. Both pin the same playwright-core,
// so a browser that --install-browser downloads serves both.
import { findChrome } from '../benchmarks/harness/chrome.mjs';
import { Runner, exec, indent, repo } from './lib.mjs';
import * as kit from './suites/kit.mjs';
import * as nitro from './suites/nitro.mjs';
import * as todos from './suites/todos.mjs';
import * as tracker from './suites/tracker.mjs';
import * as ui from './suites/ui.mjs';
import * as website from './suites/website.mjs';

const SUITES = { website, todos, tracker, nitro, kit, ui };

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    'install-browser': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`pnpm e2e [options]
  --only website,todos,tracker,nitro,kit,ui  run these suites (default: all)
  --no-build                              use the builds that are there
  --headed                                show the browser
  --install-browser                       download Playwright's Chromium when no Chrome is found`);
  process.exit(0);
}

const names = values.only ? values.only.split(',').map((name) => name.trim()) : Object.keys(SUITES);
const unknown = names.filter((name) => !(name in SUITES));
if (unknown.length > 0) {
  console.error(
    `Unknown suite: ${unknown.join(', ')}. The suites are ${Object.keys(SUITES).join(', ')}.`,
  );
  process.exit(2);
}

const launch = findChrome({ install: values['install-browser'] });
if (!launch) {
  console.error(`No Chrome found. The smoke tests run in Chrome.
  - Set CHROME_PATH to a Chrome or Chromium executable, or
  - pass --install-browser to download Playwright's Chromium.`);
  process.exit(2);
}

const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const output = path.join(repo, 'e2e/.output', stamp);
const runner = new Runner(output);

// Servers that are running, so an interrupt stops them too.
const running = new Set();
let browser;
async function cleanUp() {
  await Promise.allSettled([...running].map((stop) => stop()));
  running.clear();
  await browser?.close().catch(() => {});
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`\n${signal}: stopping the servers.`);
    void cleanUp().then(() => process.exit(130));
  });
}

async function buildAll() {
  const steps = [['pnpm', ['build']], ...names.flatMap((name) => SUITES[name].build)];
  console.log('Building');
  for (const [command, args, options] of steps) {
    const label = `${command} ${args.join(' ')}`;
    const start = Date.now();
    try {
      await exec(command, args, options);
    } catch (error) {
      console.log(`  FAIL ${label}`);
      console.log(indent(error.message, '       '));
      return false;
    }
    console.log(`  ok   ${label} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
  }
  return true;
}

let exitCode = 0;
try {
  if (!values['no-build'] && !(await buildAll())) {
    exitCode = 1;
  } else {
    browser = await chromium.launch({ ...launch, headless: !values.headed });
    for (const name of names) {
      console.log(`\n${name}`);
      const suite = SUITES[name];
      let server;
      try {
        server = await suite.start();
        running.add(server.stop);
        console.log(`  serving ${server.url}`);
      } catch (error) {
        runner.results.push({
          suite: name,
          name: 'start the server',
          ok: false,
          error: error.message,
        });
        console.log(`  FAIL start the server\n${indent(error.message, '         ')}`);
        continue;
      }
      try {
        await suite.run({ browser, url: server.url, runner });
      } catch (error) {
        // A step catches its own errors. This is an error between steps.
        runner.results.push({ suite: name, name: 'run the suite', ok: false, error: error.stack });
        console.log(`  FAIL run the suite\n${indent(error.stack, '         ')}`);
      } finally {
        await server.stop();
        running.delete(server.stop);
      }
    }
  }
} finally {
  await cleanUp();
}

const { results } = runner;
const failed = results.filter((result) => !result.ok && !result.skipped);
const skipped = results.filter((result) => result.skipped);
if (results.length > 0) {
  console.log('\nSummary');
  for (const name of names) {
    const own = results.filter((result) => result.suite === name);
    const bad = own.filter((result) => !result.ok && !result.skipped).length;
    const skip = own.filter((result) => result.skipped).length;
    console.log(
      `  ${bad > 0 ? 'FAIL' : 'ok  '} ${name}: ${own.length - bad - skip} passed, ${bad} failed${skip ? `, ${skip} skipped` : ''}`,
    );
  }
}
if (failed.length > 0) {
  console.log('\nFailures');
  for (const result of failed) {
    console.log(`  ${result.suite} > ${result.name}`);
    console.log(indent(result.error ?? '', '      '));
    for (const file of result.files ?? []) {
      console.log(`      saved ${path.relative(repo, file)}`);
    }
  }
  exitCode = 1;
}
if (skipped.length > 0) {
  console.log(`\n${skipped.length} steps skipped after a failure in their flow.`);
}
process.exit(exitCode);
