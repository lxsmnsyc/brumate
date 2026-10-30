import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

// Returns the launch options for playwright-core, or null when no browser is found.
export function findChrome({ install = false } = {}) {
  if (process.env.CHROME_PATH) {
    if (existsSync(process.env.CHROME_PATH)) {
      return { executablePath: process.env.CHROME_PATH };
    }
    console.warn(`CHROME_PATH is set but ${process.env.CHROME_PATH} does not exist.`);
    return null;
  }
  let found;
  for (const file of CANDIDATES[process.platform] ?? []) {
    if (existsSync(file)) {
      found = file;
      break;
    }
  }
  if (found) {
    return { executablePath: found };
  }
  if (install) {
    // Downloads Playwright's own Chromium build, only when --install-browser is passed.
    const cli = createRequire(import.meta.url).resolve('playwright-core/cli');
    execFileSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit' });
    return {};
  }
  return null;
}

export const MISSING_CHROME = `No Chrome found. The browser and waterfall metrics need one.
  - Set CHROME_PATH to a Chrome or Chromium executable, or
  - pass --install-browser to download Playwright's Chromium, or
  - pass --skip browser,waterfall to run the other metrics only.`;
