// Profiles the rows page: the self time of each function for one operation, from a CPU profile.
// Usage: node profile-rows.mjs <framework> <create|replace|append> [rounds]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome.mjs';

const [name = 'brumate', op = 'create', roundsArg = '5'] = process.argv.slice(2);
const rounds = Number(roundsArg);
const server = spawn(process.execPath, ['serve.mjs', name, 'rows'], { cwd: import.meta.dirname });
const port = await new Promise((resolve) => {
  server.stdout.on('data', (chunk) => {
    const match = /ready (\d+)/.exec(String(chunk));
    if (match) resolve(Number(match[1]));
  });
});
const browser = await chromium.launch({ ...findChrome(), headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForLoadState('load');
await page.waitForTimeout(500);
const rows = () => page.evaluate(() => document.querySelectorAll('tbody tr').length);
const click = async (selector, until) => {
  await page.click(selector);
  await page.waitForFunction(until);
};
const session = await page.context().newCDPSession(page);
await session.send('Profiler.enable');
await session.send('Profiler.setSamplingInterval', { interval: 50 });
const self = new Map();
let total = 0;
for (let round = 0; round < rounds + 2; round++) {
  await click('#clear', () => document.querySelectorAll('tbody tr').length === 0);
  if (op === 'replace' || op === 'append') {
    await click('#run', () => document.querySelectorAll('tbody tr').length === 1000);
  }
  const measured = round >= 2;
  if (measured) await session.send('Profiler.start');
  if (op === 'append') {
    await click('#add', () => document.querySelectorAll('tbody tr').length === 2000);
  } else {
    await click('#run', () => document.querySelectorAll('tbody tr').length === 1000);
  }
  if (!measured) continue;
  const { profile } = await session.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const interval = (profile.endTime - profile.startTime) / profile.samples.length;
  for (const id of profile.samples) {
    const frame = byId.get(id).callFrame;
    const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + interval / 1000);
    if (!/\(idle\)|\(program\)/.test(frame.functionName)) total += interval / 1000;
  }
}
await browser.close();
server.kill();
console.log(`${name} ${op}: ${(total / rounds).toFixed(1)} ms of script and native work a round`);
for (const [key, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 28)) {
  console.log(`${(ms / rounds).toFixed(2).padStart(7)} ms  ${key}`);
}
