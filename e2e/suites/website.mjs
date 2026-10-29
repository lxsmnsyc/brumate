import { createRequire } from 'node:module';
// The website as a static host serves it: every docs page with a live sample,
// the home page, and client navigation between pages.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assert, freePort, repo, startProcess, watch } from '../lib.mjs';

const root = path.join(repo, 'website');
const TIMEOUT = 20_000;

export const build = [['pnpm', ['--filter', 'website', 'build']]];

export async function start() {
  assert(
    existsSync(path.join(root, 'dist/client/index.html')),
    'website/dist is missing. Run without --no-build.',
  );
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const stop = await startProcess(process.execPath, ['scripts/preview.ts'], {
    cwd: root,
    env: { PORT: String(port) },
    url,
  });
  return { url, stop };
}

/**
 * The docs pages with live samples, and the number of samples of each. Code
 * blocks such as ```brm live next to each other are the files of one sample.
 */
export function livePages() {
  const folder = path.join(root, 'docs');
  const pages = [];
  for (const file of readdirSync(folder).toSorted()) {
    if (!file.endsWith('.md')) {
      continue;
    }
    const lines = readFileSync(path.join(folder, file), 'utf8').split('\n');
    let fence = '';
    let samples = 0;
    // The line where the last live block ended, to join the blocks next to it.
    let lastEnd = -2;
    let live = false;
    lines.forEach((line, index) => {
      const match = /^(`{3,}|~{3,})(.*)$/.exec(line.trim());
      if (fence) {
        if (match && match[1].startsWith(fence) && match[2].trim() === '') {
          fence = '';
          if (live) {
            lastEnd = index;
          }
        }
        return;
      }
      if (!match) {
        if (line.trim() !== '') {
          lastEnd = -2;
        }
        return;
      }
      fence = match[1];
      live = /^(?:brm|html|ts)\s+live\b/.test(match[2].trim());
      if (live && lastEnd === -2) {
        samples++;
      }
      if (!live) {
        lastEnd = -2;
      }
    });
    if (samples > 0) {
      const name = file.slice(0, -3);
      pages.push({ path: name === 'index' ? '/docs' : `/docs/${name}`, samples });
    }
  }
  return pages;
}

/** Scrolls each live sample into view, where it runs, and waits for its result. */
async function runSamples(page) {
  const figures = await page.locator('figure.live').all();
  for (const [index, figure] of figures.entries()) {
    await figure.scrollIntoViewIfNeeded();
    const label = await sampleLabel(figure, index);
    try {
      await figure.evaluate(
        (element, timeout) =>
          new Promise((resolve, reject) => {
            const done = () => {
              const result = element.querySelector('.live-result');
              if (element.querySelector('.live-error')) {
                return true;
              }
              return (
                !element.querySelector('.live-status') &&
                !result.querySelector('.live-placeholder') &&
                result.firstElementChild?.hasChildNodes()
              );
            };
            if (done()) {
              resolve();
              return;
            }
            const observer = new MutationObserver(() => {
              if (done()) {
                observer.disconnect();
                resolve();
              }
            });
            observer.observe(element, { subtree: true, childList: true, characterData: true });
            setTimeout(() => {
              observer.disconnect();
              reject(new Error('timed out'));
            }, timeout);
          }),
        TIMEOUT,
      );
    } catch {
      throw new Error(`${label} did not render a result in ${TIMEOUT} ms`);
    }
    const error = figure.locator('.live-error');
    if ((await error.count()) > 0) {
      throw new Error(`${label} shows an error: ${(await error.textContent()).trim()}`);
    }
  }
  return figures;
}

/** "sample 2 (under “Validating a form”)", for messages. */
async function sampleLabel(figure, index) {
  const heading = await figure.evaluate((element) => {
    let node = element.previousElementSibling;
    while (node && !/^H[1-3]$/.test(node.tagName)) {
      node = node.previousElementSibling;
    }
    return node?.textContent.trim() ?? '';
  });
  return `sample ${index + 1}${heading ? ` (under "${heading}")` : ''}`;
}

/** Clicks every visible button in the result of each sample. */
async function clickButtons(page, figures, url) {
  let clicks = 0;
  for (const [index, figure] of figures.entries()) {
    const buttons = await figure.locator('.live-result button').all();
    for (const button of buttons) {
      if (!(await button.isVisible()) || !(await button.isEnabled())) {
        continue;
      }
      try {
        await button.click({ timeout: 2000 });
        clicks++;
      } catch (error) {
        // A click can hide or disable the next button. A button that is still there must click.
        if (
          (await button.count()) > 0 &&
          (await button.isVisible()) &&
          (await button.isEnabled())
        ) {
          const label = await sampleLabel(figure, index);
          throw new Error(`${label}: a button did not click: ${error.message.split('\n')[0]}`, {
            cause: error,
          });
        }
      }
      await page.waitForTimeout(100);
      assert(page.url() === url, `a button of a sample went to ${page.url()}`);
    }
  }
  // Server functions and streamed parts answer after the click.
  await page.waitForTimeout(500);
  return clicks;
}

const axe = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

// Helpers of the flow of the date parts. A demo shows its state in its last paragraph.
const status = async (scope) => (await scope.locator('p').last().innerText()).trim();
const segment = (field, index) =>
  field.locator('[data-segment]:not([data-type=literal])').nth(index);
const dateText = async (field) => (await field.locator('[data-segment]').allInnerTexts()).join('');
const press = (scope, name) => scope.getByRole('button', { name, exact: true }).click();
const cell = (scope, date) => scope.locator(`[data-date="${date}"]`);

export async function run({ browser, url, runner }) {
  const step = (name, options, check) => runner.step('website', name, options, check);
  const pages = livePages();
  assert(pages.length > 0, 'no docs page has a live sample');

  for (const { path: pathname, samples } of pages) {
    const page = await browser.newPage();
    const errors = watch(page);
    const options = { page, errors };
    let figures = [];
    const loaded = await step(`${pathname}: ${samples} live samples render`, options, async () => {
      await page.goto(url + pathname, { waitUntil: 'load' });
      const count = await page.locator('figure.live').count();
      assert(count === samples, `the page has ${count} live samples, the markdown has ${samples}`);
      figures = await runSamples(page);
    });
    if (loaded) {
      await step(`${pathname}: buttons in samples click`, options, async () => {
        await clickButtons(page, figures, url + pathname);
      });
    }
    await page.close();
  }

  // The counter of the first sample of the state page counts.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    await step('/docs/state: the counter sample increments', { page, errors }, async () => {
      await page.goto(`${url}/docs/state`, { waitUntil: 'load' });
      const figure = page.locator('figure.live').first();
      await figure.scrollIntoViewIfNeeded();
      const button = figure.locator('.live-result button', { hasText: /Clicked \d+ times/ });
      await button.waitFor({ timeout: TIMEOUT });
      assert(
        (await button.textContent()).trim() === 'Clicked 0 times',
        `the counter starts at "${await button.textContent()}"`,
      );
      await button.click();
      await button.click();
      await figure
        .locator('.live-result button', { hasText: 'Clicked 2 times' })
        .waitFor({ timeout: 5000 })
        .catch(async () => {
          throw new Error(`after two clicks the button reads "${await button.textContent()}"`);
        });
      const double = (await figure.locator('.live-result p').first().textContent()).trim();
      assert(double === 'Double: 4', `the memo reads "${double}", not "Double: 4"`);
    });
    await page.close();
  }

  // The shop list of the home page names chunks, so a rename would empty it.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    await step('/: the shop list shows the bundle of the shop', { page, errors }, async () => {
      await page.goto(`${url}/`, { waitUntil: 'load' });
      const rows = page.locator('[data-network] ol li:not(.empty)');
      await rows.first().waitFor({ timeout: TIMEOUT });
      const names = await rows.locator('.file').allTextContents();
      assert(
        names.some((name) => name.startsWith('Index')),
        `the shop list shows ${JSON.stringify(names)}, without the bundle of the page`,
      );
    });
    await page.close();
  }

  // The validation sample of the forms page.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    const flow = runner.flow('website', { page, errors });
    let form;
    await flow('/docs/forms: the validation sample renders its form', async () => {
      await page.goto(`${url}/docs/forms`, { waitUntil: 'load' });
      await page.locator('h2', { hasText: 'Validating a form' }).scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 300);
      form = page.locator('.live-result form:has(input[name="age"])').first();
      await form.waitFor({ timeout: TIMEOUT });
    });
    await flow('/docs/forms: bad input shows both field errors', async () => {
      await form.locator('input[name="email"]').fill('nope');
      await form.locator('input[name="age"]').fill('12');
      await form.locator('button').click();
      const alerts = form.locator('[role=alert]');
      await alerts
        .nth(1)
        .waitFor({ timeout: 5000 })
        .catch(async () => {
          throw new Error(`the form shows ${await alerts.count()} field errors, not 2`);
        });
      const texts = (await alerts.allTextContents()).map((text) => text.trim());
      assert(
        texts.join('|') === 'Enter an email address|You must be 18 or older',
        `the field errors are ${JSON.stringify(texts)}`,
      );
    });
    await flow('/docs/forms: good input signs up', async () => {
      await form.locator('input[name="email"]').fill('ada@example.com');
      await form.locator('input[name="age"]').fill('36');
      await form.locator('button').click();
      await page
        .locator('.live-result p', { hasText: 'Signed up as ada@example.com.' })
        .waitFor({ timeout: 5000 });
      assert(
        (await form.locator('[role=alert]').count()) === 0,
        'the field errors stay after good input',
      );
      assert(page.url() === `${url}/docs/forms`, `the form went to ${page.url()}`);
    });
    await page.close();
  }

  // The `#offscreen` sample of the control flow page keeps a hidden draft.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    const flow = runner.flow('website', { page, errors });
    let result;
    await flow('/docs/control-flow: the #offscreen sample renders its note', async () => {
      await page.goto(`${url}/docs/control-flow`, { waitUntil: 'load' });
      await page.locator('h2', { hasText: '#offscreen' }).scrollIntoViewIfNeeded();
      result = page.locator('.live-result:has(.note)').first();
      await result.locator('.note textarea').waitFor({ timeout: TIMEOUT });
    });
    await flow('/docs/control-flow: a hidden tab keeps its draft', async () => {
      await result.locator('.note textarea').fill('Hello');
      await result.locator('.count', { hasText: '5 characters' }).waitFor({ timeout: 5000 });
      await result.locator('button', { hasText: 'Reply' }).click();
      await result.locator('.reply').waitFor({ timeout: 5000 });
      // The class sets `display: grid`, and the hidden note stays hidden.
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('.live-result .note')).display === 'none',
        null,
        { timeout: 5000 },
      );
      await result.locator('button', { hasText: 'Note' }).click();
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('.live-result .note')).display === 'grid',
        null,
        { timeout: 5000 },
      );
      const draft = await result.locator('.note textarea').inputValue();
      assert(draft === 'Hello', `the note reads "${draft}" after switching tabs`);
      assert(
        (await result
          .locator('.reply')
          .evaluate((element) => getComputedStyle(element).display)) === 'none',
        'the reply shows next to the note',
      );
    });
    await page.close();
  }

  // The home page, and client navigation between docs pages.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    const flow = runner.flow('website', { page, errors });
    await flow('/: the home page loads and its shop demo adds to the cart', async () => {
      await page.goto(url, { waitUntil: 'load' });
      const button = page.locator('.shop-add');
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.locator('.shop-cart b', { hasText: '1' }).waitFor({ timeout: 5000 });
    });
    await flow('/: a link to the docs navigates on the client', async () => {
      await page.evaluate(() => (window.__e2eSamePage = true));
      await page.locator('.header-nav a', { hasText: 'Docs' }).click();
      await page.waitForURL(`${url}/docs`, { timeout: 5000 });
      await page.locator('.docs .sidebar').waitFor({ timeout: 5000 });
      assert(
        await page.evaluate(() => window.__e2eSamePage === true),
        'the link loaded a new page',
      );
    });
    // The panel counts the scripts that the navigation loaded, however it started.
    const checkPanel = async () => {
      const panel = page.locator('[data-network]');
      await panel.waitFor({ timeout: 5000 });
      await page
        .locator('[data-network] [data-total]', { hasText: /KB$/ })
        .waitFor({ timeout: 5000 });
      const text = await panel.textContent();
      // The home page loaded its code before the visit to /docs, so a return loads nothing new.
      assert(
        text.includes('Nothing new') && !text.includes('Index'),
        `the panel lists the scripts of the first load: ${text}`,
      );
      assert(text.includes('0 KB'), `the panel does not read 0 KB: ${text}`);
    };
    const backToDocs = async () => {
      // The next flows start from /docs.
      await page.locator('.header-nav a', { hasText: 'Docs' }).click();
      await page.waitForURL(`${url}/docs`, { timeout: 5000 });
      await page.locator('.docs .sidebar').waitFor({ timeout: 5000 });
    };
    await flow(
      '/docs: the brand link returns to / with a panel of the navigation only',
      async () => {
        await page.locator('.brand').click();
        await page.waitForURL(`${url}/`, { timeout: 5000 });
        await checkPanel();
        await backToDocs();
      },
    );
    await flow('/docs: a navigation with no click returns to / with the same panel', async () => {
      // A fresh load of /, then two navigations with no click.
      await page.goto(`${url}/`, { waitUntil: 'load' });
      await page.evaluate(() => (window.__e2eSamePage = true));
      const visit = (to) =>
        page.evaluate(
          (target) =>
            document.dispatchEvent(
              new CustomEvent('brumate:navigate', {
                cancelable: true,
                detail: { url: target, replace: false, scroll: true, done() {} },
              }),
            ),
          to,
        );
      await visit('/docs');
      await page.waitForURL(`${url}/docs`, { timeout: 5000 });
      await page.locator('.docs .sidebar').waitFor({ timeout: 5000 });
      await visit('/');
      await page.waitForURL(`${url}/`, { timeout: 5000 });
      await checkPanel();
      await backToDocs();
    });
    await flow('/docs: a sidebar link navigates on the client', async () => {
      await page.locator('.sidebar a[href="/docs/state"]').click();
      await page.waitForURL(`${url}/docs/state`, { timeout: 5000 });
      await page.locator('article h1', { hasText: 'State' }).waitFor({ timeout: 5000 });
      assert(
        await page.evaluate(() => window.__e2eSamePage === true),
        'the link loaded a new page',
      );
      const title = await page.title();
      assert(title.startsWith('State'), `the title is "${title}"`);
      assert(
        (await page.locator('.sidebar a.active').textContent()).trim() === 'State',
        'the sidebar does not mark the new page',
      );
      // The new page runs its live samples too.
      await runSamples(page);
    });
    await flow('/docs/state: the back button returns to /docs', async () => {
      const heading = page.locator('article h1').first();
      await page.goBack();
      await page.waitForURL(`${url}/docs`, { timeout: 5000 });
      await page.waitForFunction(
        () => !document.querySelector('.sidebar a.active[href="/docs/state"]'),
        null,
        { timeout: 5000 },
      );
      assert(
        await page.evaluate(() => window.__e2eSamePage === true),
        'the back button loaded a new page',
      );
      assert(
        !/^State$/.test((await heading.textContent()).trim()),
        'the page still shows the state page',
      );
    });
    await page.close();
  }

  // The section of @brumate/ui, with its own header, sidebar and search.
  {
    const page = await browser.newPage();
    const errors = watch(page);
    const flow = runner.flow('website', { page, errors });
    await flow(
      '/ui: the link in the header navigates on the client to a section of its own',
      async () => {
        await page.goto(`${url}/docs`, { waitUntil: 'load' });
        await page.evaluate(() => (window.__e2eSamePage = true));
        await page.locator('.header-nav a', { hasText: 'UI' }).click();
        await page.waitForURL(`${url}/ui`, { timeout: 5000 });
        await page.locator('.hero .install').waitFor({ timeout: 5000 });
        assert(
          await page.evaluate(() => window.__e2eSamePage === true),
          'the link loaded a new page',
        );
        // The root layout stays, and its header changes to the one of the section.
        await page.waitForFunction(
          () => {
            const nav = document.querySelector('.header-nav')?.textContent ?? '';
            return nav.includes('brumate') && !nav.includes('REPL') && !nav.includes('Parts');
          },
          null,
          { timeout: 5000 },
        );
        // The landing page has no sidebar, like the home page, and its parts work.
        assert(await page.locator('.sidebar').isHidden(), 'the landing page shows a sidebar');
        const stage = page.locator('.stage-section');
        await stage.locator('.ui-box', { hasText: 'Wi-Fi is off' }).click();
        await stage.locator('.ui-box', { hasText: 'Wi-Fi is on' }).waitFor({ timeout: 5000 });
        await page.addScriptTag({ path: axe });
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run();
          return result.violations.map((violation) => violation.id);
        });
        assert(violations.length === 0, `axe found on /ui: ${violations.join(', ')}`);
        // The grid of cards is on the landing page, and every card has the same size.
        const sizes = await page.locator('.ui-card').evaluateAll((cards) => [
          ...new Set(
            cards.map((card) => {
              const stage = card.querySelector('.ui-demo-stage').getBoundingClientRect();
              const box = card.getBoundingClientRect();
              return `${Math.round(box.width)}x${Math.round(box.height)} ${Math.round(stage.width)}x${Math.round(stage.height)}`;
            }),
          ),
        ]);
        assert(sizes.length === 1, `the cards have different sizes: ${sizes.join(', ')}`);
        const cards = await page.locator('.ui-card').count();
        assert(cards >= 10, `the gallery has ${cards} cards`);
      },
    );
    await flow('/ui: a card opens its page, and its preview takes no input', async () => {
      const card = page.locator('.ui-card', { hasText: 'Switch' });
      assert(
        await card.locator('.ui-demo-stage').evaluate((stage) => stage.inert),
        'the preview is not inert',
      );
      // The link covers the card, so a click on the preview opens the page. The site scrolls
      // smoothly, so the step scrolls at once and reads the place of the preview after it.
      const stage = card.locator('.ui-demo-stage');
      // The view transition of the navigation takes the clicks until it ends.
      await page.waitForFunction(() => document.getAnimations().length === 0, null, {
        timeout: 5000,
      });
      await stage.evaluate((element) =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      const box = await stage.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      // Client navigation fires no load event, so the step waits for the address.
      await page.waitForFunction(() => location.pathname === '/ui/switch', null, { timeout: 5000 });
      await page.waitForFunction(() => document.getAnimations().length === 0, null, {
        timeout: 5000,
      });
      await page.locator('.ui-demo .ui-box', { hasText: 'Wi-Fi is on' }).click();
      await page
        .locator('.ui-demo .ui-box', { hasText: 'Wi-Fi is off' })
        .waitFor({ timeout: 5000 });
    });
    await flow('/ui: the search finds only the pages of the section', async () => {
      await page.locator('.search input').fill('toolbar');
      await page.locator('.search-results a').first().waitFor({ timeout: 5000 });
      const links = await page
        .locator('.search-results a')
        .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
      assert(
        links.length > 0 && links.every((href) => href.startsWith('/ui')),
        `the results link to ${links.join(', ')}`,
      );
    });
    await flow(
      '/ui/text-field: its demos with their source, and no accessibility violations',
      async () => {
        await page.goto(`${url}/ui/text-field`, { waitUntil: 'load' });
        assert((await page.locator('.ui-demo pre').count()) >= 2, 'the demos show no source');
        await page.addScriptTag({ path: axe });
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run(document.querySelector('article'));
          return result.violations.map(
            (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
          );
        });
        assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
      },
    );
    await flow(
      '/ui/select: the anatomy picture and the styled example, with no accessibility violations',
      async () => {
        for (const scheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto(`${url}/ui/select`, { waitUntil: 'load' });
          const marks = await page.locator('.anatomy [data-mark]').count();
          const items = await page.locator('.anatomy-list li').count();
          assert(marks > 0 && marks === items, `${marks} callouts for ${items} listed pieces`);
          assert(
            (await page.locator('.styled pre').count()) === 1,
            'the styled example shows no CSS',
          );
          await page.addScriptTag({ path: axe });
          const violations = await page.evaluate(async () => {
            const result = await window.axe.run(document.querySelector('article'));
            return result.violations.map((violation) => violation.id);
          });
          assert(violations.length === 0, `axe found in ${scheme}: ${violations.join(', ')}`);
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: the pages of Buttons have a styled example, and an anatomy picture where they have pieces',
      async () => {
        const pieces = new Set(['toggle-button-group', 'drop-zone']);
        for (const slug of [
          'button',
          'toggle-button',
          'toggle-button-group',
          'link',
          'file-trigger',
          'drop-zone',
        ]) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              pieces.has(slug) ? marks > 0 && marks === items : marks === 0,
              `/ui/${slug}: ${marks} callouts for ${items} listed pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: the pages of Forms that are done have a styled example, and an anatomy picture where they have pieces',
      async () => {
        const pieces = new Set(['checkbox-group', 'radio-group', 'form']);
        for (const slug of ['checkbox', 'switch', 'checkbox-group', 'radio-group', 'form']) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              pieces.has(slug) ? marks > 0 && marks === items : marks === 0,
              `/ui/${slug}: ${marks} callouts for ${items} listed pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: the pages of the text and number fields have an anatomy picture and a styled example',
      async () => {
        for (const slug of [
          'text-field',
          'search-field',
          'token-field',
          'number-field',
          'slider',
        ]) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            // The token template of a TokenInput is also drawn in a hidden copy, which has no callout.
            const marks = await page.locator('.anatomy [data-mark]:not([hidden] *)').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              marks > 0 && marks === items,
              `/ui/${slug}: ${marks} callouts for ${items} pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow('/ui: the text and number fields edit, refuse, reset and send', async () => {
      const settle = () => page.waitForTimeout(500);
      const visit = async (slug) => {
        await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
        await settle();
      };
      const state = () => page.locator('form.ui-stack', { hasText: 'Asks you first' });
      const line = () => state().locator('p').textContent();
      // TextField: a refused edit leaves the typed text in the input, a reset puts the kept one back.
      await visit('text-field');
      const asks = state().getByLabel('Asks you first');
      await state().getByRole('button', { name: /^Lock/ }).click();
      await asks.click();
      await page.keyboard.type('xyz');
      assert((await asks.inputValue()) === 'Adaxyz', 'the input lost the typed text');
      assert((await line()).includes('Asks: "Ada"'), `the signal changed: ${await line()}`);
      await state().getByRole('button', { name: 'Reset the form' }).click();
      await settle();
      assert((await asks.inputValue()) === 'Ada', 'the reset did not put the kept text back');
      await page.getByLabel('Find a city').click();
      await page.keyboard.type('ly');
      assert(
        (await page.getByRole('list', { name: 'Cities' }).innerText()) === 'Lyon',
        'the city list did not follow the text',
      );
      // SearchField: Escape clears a field with text, and closes the dialog only when it is empty.
      await visit('search-field');
      const search = page.getByLabel('Search the parts').last();
      await search.click();
      await page.keyboard.type('se');
      await page.keyboard.press('Enter');
      assert(
        (await page.locator('p', { hasText: /results? for/ }).innerText()).includes('Select'),
        'Enter did not search',
      );
      await page.keyboard.press('Escape');
      assert((await search.inputValue()) === '', 'Escape left the text');
      await page.getByRole('button', { name: 'Find a file' }).click();
      await page.waitForFunction(() => document.activeElement?.matches('[role=dialog] input'));
      await page.keyboard.type('abc');
      await page.keyboard.press('Escape');
      await settle();
      assert((await page.getByRole('dialog').count()) === 1, 'Escape closed the dialog with text');
      assert(
        (await page.getByLabel('File name').inputValue()) === '',
        'Escape did not clear the text',
      );
      await page.keyboard.press('Escape');
      await settle();
      assert(
        (await page.getByRole('dialog').count()) === 0,
        'Escape on an empty field did not close',
      );
      // TokenField: a typed @name becomes a token, a form sends the text, a filter token filters.
      await visit('token-field');
      const mine = page.locator('form', { hasText: 'A form sends' });
      await mine.getByRole('textbox').click();
      await page.keyboard.type('hello @ada ');
      await page.waitForFunction(
        () => document.querySelectorAll('form [data-token="@ada"]').length > 0,
      );
      await mine.getByRole('button', { name: 'Send' }).click();
      assert(
        (await mine.locator('[role=status]').innerText()) === 'Sent "hello @ada".',
        `the form sent: ${await mine.locator('[role=status]').innerText()}`,
      );
      const searchbox = page.getByRole('searchbox', { name: 'Search', exact: true });
      await searchbox.click();
      await page.keyboard.press('End');
      await page.keyboard.type('owner:ada ');
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label=Issues]')?.textContent ===
          'Slider thumb jumps (ada, bug)',
      );
      // NumberField: a refused step keeps the number, the end of the range stops the field.
      await visit('number-field');
      const number = state().getByRole('textbox', { name: 'Asks you first' });
      await state().getByRole('button', { name: /^Lock/ }).click();
      await number.click();
      await page.keyboard.press('ArrowUp');
      assert((await number.inputValue()) === '2', `the number shows ${await number.inputValue()}`);
      await state()
        .getByRole('button', { name: /^Unlock/ })
        .click();
      await number.click();
      await page.keyboard.press('ArrowUp');
      assert((await number.inputValue()) === '3', 'ArrowUp did not step');
      const seats = page.getByRole('textbox', { name: 'Seats' });
      await seats.click();
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press('ArrowUp');
      }
      assert((await seats.inputValue()) === '8', 'the seats passed the maximum');
      assert(
        await page.getByRole('button', { name: 'Increase Seats' }).isDisabled(),
        'the plus button is not disabled at the maximum',
      );
      assert(
        await seats.evaluate((input) => document.activeElement === input),
        'focus left the input',
      );
      const discount = page.getByRole('textbox', { name: 'Discount' });
      const percent = page.locator('form', { hasText: 'From 0% to 50%' });
      await discount.click();
      await page.keyboard.press('ArrowUp');
      assert((await discount.inputValue()) === '15%', 'the percent did not step by 5%');
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await percent.getByRole('button', { name: 'Send' }).click();
      await settle();
      assert(
        (await percent.locator('[role=status]').innerText()) === 'Nothing sent.',
        'a required field sent an empty number',
      );
      // Slider: a refused key keeps the value, a range filters on release.
      await visit('slider');
      const thumb = state().getByRole('slider', { name: 'Asks you first' });
      await state().getByRole('button', { name: /^Lock/ }).click();
      await thumb.focus();
      await page.keyboard.press('ArrowRight');
      assert((await thumb.inputValue()) === '30', `the thumb shows ${await thumb.inputValue()}`);
      assert((await line()).includes('Asks: 30'), 'the signal changed');
      await state()
        .getByRole('button', { name: /^Unlock/ })
        .click();
      await thumb.focus();
      await page.keyboard.press('ArrowRight');
      assert((await thumb.inputValue()) === '31', 'ArrowRight did not step');
      const lowest = page.getByRole('slider', { name: /Lowest price/ });
      await lowest.focus();
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
      }
      assert(
        (await page.getByRole('list', { name: 'Rooms' }).innerText()).startsWith('Garden'),
        'the range did not filter the rooms',
      );
      await page.getByRole('button', { name: 'Smile' }).click();
      assert(
        (await page.getByRole('slider', { name: 'Low', exact: true }).inputValue()) === '80',
        'the preset did not write the sliders',
      );
    });
    await flow(
      '/ui: the pages of the color parts have a styled example, and an anatomy picture where they have pieces',
      async () => {
        const pieces = new Set([
          'color-slider',
          'color-area',
          'color-wheel',
          'color-field',
          'color-swatch-picker',
        ]);
        const slugs = [
          'color-picker',
          'color-swatch',
          'color-slider',
          'color-area',
          'color-wheel',
          'color-field',
          'color-swatch-picker',
        ];
        for (const slug of slugs) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              pieces.has(slug) ? marks > 0 && marks === items : marks === 0,
              `/ui/${slug}: ${marks} callouts for ${items} listed pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: the pages of the date parts have an anatomy picture and a styled example',
      async () => {
        const slugs = [
          'calendar',
          'range-calendar',
          'date-field',
          'time-field',
          'date-picker',
          'date-range-picker',
        ];
        for (const slug of slugs) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              marks > 0 && marks === items,
              `/ui/${slug}: ${marks} callouts for ${items} listed pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    const dateDemo = (text) => page.locator('.ui-demo', { hasText: text }).first();
    const dateVisit = async (slug) => {
      await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
    };
    await flow(
      '/ui: the Calendar picks by click and keys, keeps a locked date and skips a taken day',
      async () => {
        // Calendar: a click and the keys pick, a locked signal keeps its date, a taken day cannot be picked.
        await dateVisit('calendar');
        const calendars = dateDemo('Writes your signal');
        const grids = calendars.locator('[role=application]');
        await cell(grids.nth(2), '2026-10-14').click();
        assert((await status(calendars)).includes('Writes: 2026-10-14'), 'a click picks no date');
        await press(calendars, 'Lock the signal');
        await cell(grids.nth(3), '2026-10-21').click();
        assert((await status(calendars)).includes('Asks: 2026-10-15'), 'a locked signal changed');
        await cell(grids.nth(1), '2026-10-15').focus();
        for (let index = 0; index < 5; index++) {
          await page.keyboard.press('ArrowRight');
        }
        await page.keyboard.press('Enter');
        assert(
          (await grids.nth(1).locator('[data-selected]').getAttribute('data-date')) ===
            '2026-10-20',
          'the arrow keys and Enter picked another date',
        );
        const booking = dateDemo('Mondays and three days');
        await cell(booking, '2026-11-09').click({ force: true });
        assert((await status(booking)).includes('Pick a day'), 'a Monday was picked');
        await cell(booking, '2026-12-10').click();
        assert((await status(booking)).includes('Booked for 2026-12-10'), 'no date in month two');
      },
    );
    await flow('/ui: the RangeCalendar picks a stay', async () => {
      // RangeCalendar: two presses make a range, and the nights follow.
      await dateVisit('range-calendar');
      const stay = dateDemo('The 10th and 11th');
      await cell(stay, '2026-11-05').click();
      await cell(stay, '2026-11-09').click();
      assert((await status(stay)).includes('4 nights'), `the stay says "${await status(stay)}"`);
    });
    await flow('/ui: the DateField takes digits, resets and blocks the form', async () => {
      // DateField: typed digits, a locked signal, a reset, and a limit that blocks the form.
      await dateVisit('date-field');
      const fields = dateDemo('Writes your signal');
      const field = fields.locator('.ui-field');
      await segment(field.nth(2), 0).click();
      await page.keyboard.type('12312027', { delay: 25 });
      assert((await status(fields)).includes('Writes: 2027-12-31'), 'typing wrote no date');
      await press(fields, 'Reset the form');
      await page.waitForTimeout(200);
      assert((await status(fields)).includes('Writes: 2026-10-15'), 'a reset gave no first date');
      assert((await dateText(field.nth(2))) === '10/15/2026', 'the segments kept the typed date');
      const form = dateDemo('Empty a segment');
      await segment(form.locator('.ui-field'), 2).click();
      await page.keyboard.press('End');
      await press(form, 'Save');
      assert(
        (await status(form)) === 'Fix the field first.',
        `the form says "${await status(form)}"`,
      );
      await press(form, 'Reset');
      await press(form, 'Save');
      assert((await status(form)).includes('birthday=2000-02-29'), 'a reset gave no first date');
    });
    await flow('/ui: the TimeField checks a closing time against the opening time', async () => {
      // TimeField: a closing time before the opening one is invalid and blocks the form.
      await dateVisit('time-field');
      const hours = dateDemo('Opens');
      const times = hours.locator('.ui-field');
      await segment(times.nth(1), 0).click();
      await page.keyboard.type('0700', { delay: 25 });
      await page.keyboard.press('a');
      assert((await times.nth(1).getAttribute('data-invalid')) !== null, 'a 7 AM close is valid');
      await press(hours, 'Save');
      assert(
        (await status(hours)) === 'Fix the field first.',
        `the hours say "${await status(hours)}"`,
      );
      await segment(times.nth(0), 0).click();
      await page.keyboard.type('0600', { delay: 25 });
      await page.keyboard.press('a');
      await press(hours, 'Save');
      assert(
        (await status(hours)).includes('opens=06:00, closes=07:00'),
        `the hours say "${await status(hours)}"`,
      );
    });
    await flow('/ui: the DatePicker opens, picks and gives focus back', async () => {
      // DatePicker: it opens from outside, a pick closes it and gives focus back to the button.
      await dateVisit('date-picker');
      const pickers = dateDemo('Writes your signal');
      const picker = pickers.locator('.ui-field');
      await press(pickers, 'Open the third from here');
      await page.locator('.ui-popover:visible').waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('.ui-popover'));
      await page.keyboard.press('Escape');
      await page.locator('.ui-popover:visible').waitFor({ state: 'detached' });
      const trigger = picker.nth(2).getByRole('button', { name: /Calendar/ });
      await trigger.click();
      await cell(page.locator('.ui-popover:visible'), '2026-10-21').click();
      await page.locator('.ui-popover:visible').waitFor({ state: 'detached' });
      assert((await status(pickers)).includes('Writes: 2026-10-21'), 'a pick wrote no date');
      assert(
        await trigger.evaluate((button) => button === document.activeElement),
        'focus did not go back to the button',
      );
      assert((await dateText(picker.nth(2))) === '10/21/2026', 'the field shows another date');
    });
    await flow('/ui: the DateRangePicker picks a range', async () => {
      // DateRangePicker: two presses in the RangeCalendar set both inputs.
      await dateVisit('date-range-picker');
      const ranges = dateDemo('Writes your signal');
      await ranges
        .locator('.ui-field')
        .nth(2)
        .getByRole('button', { name: /Calendar/ })
        .click();
      const layer = page.locator('.ui-popover:visible');
      await cell(layer, '2026-10-19').click();
      await cell(layer, '2026-10-22').click();
      await layer.waitFor({ state: 'detached' });
      assert(
        (await status(ranges)).includes('Writes: 2026-10-19 to 2026-10-22'),
        `the range says "${await status(ranges)}"`,
      );
    });
    await flow(
      '/ui: the pages of Overlays that are done have an anatomy picture and a styled example',
      async () => {
        for (const slug of [
          'dialog',
          'popover',
          'modal',
          'sheet',
          'tooltip',
          'preview-trigger',
          'toast',
        ]) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              marks > 0 && marks === items,
              `/ui/${slug}: ${marks} callouts for ${items} pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow('/ui: the overlays open, save, close and give focus back', async () => {
      const settle = () => page.waitForTimeout(1500);
      const focused = () =>
        page.evaluate(() => (document.activeElement?.textContent ?? '').trim().slice(0, 40));
      const visit = async (slug) => {
        await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
        await settle();
      };
      // Dialog: the rename form saves, with no reload, and Escape gives focus back.
      await visit('dialog');
      const dialogUrl = page.url();
      const rename = page.locator('button.ui-button[aria-expanded]', { hasText: /^Rename$/ });
      await rename.click();
      await page.waitForFunction(() => document.activeElement?.matches('[role=dialog] input'));
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type('Annual');
      await page.keyboard.press('Enter');
      await page.getByText('File: Annual').waitFor({ timeout: 5000 });
      await settle();
      assert(page.url() === dialogUrl, `the rename form went to ${page.url()}`);
      assert((await focused()) === 'Rename', `focus is on "${await focused()}" after saving`);
      await rename.click();
      await page.waitForFunction(() => document.activeElement?.matches('[role=dialog] input'));
      await page.keyboard.press('Escape');
      await settle();
      assert((await focused()) === 'Rename', `focus is on "${await focused()}" after Escape`);
      // Modal: a second modal opens over the first, and Escape closes only the top one.
      await visit('modal');
      await page.locator('button.ui-button', { hasText: /^Edit the greeting$/ }).click();
      await page.waitForFunction(() =>
        document.activeElement?.matches('[data-modal-overlay] input'),
      );
      await page.keyboard.type('!');
      await page
        .locator('[data-modal-overlay] [role=dialog] button', { hasText: /^Cancel$/ })
        .click();
      await page.locator('[data-modal-overlay] [role=alertdialog]').waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('[role=alertdialog]'));
      assert((await page.locator('[data-modal-overlay]').count()) === 2, 'no nested modal');
      await page.keyboard.press('Escape');
      await settle();
      const left = await page.locator('[data-modal-overlay]').count();
      assert(left === 1, `${left} modals are left after Escape`);
      await page
        .locator('[data-modal-overlay] [role=dialog] button', { hasText: /^Cancel$/ })
        .click();
      await page
        .locator('[data-modal-overlay] [role=alertdialog] button', { hasText: /^Discard$/ })
        .click();
      await settle();
      assert((await page.locator('[data-modal-overlay]').count()) === 0, 'Discard left a modal');
      // Sheet: opens from its trigger and Escape closes it.
      await visit('sheet');
      await page.locator('.sheet-styled-trigger', { hasText: 'start' }).click();
      await page.locator('.sheet-styled-box').waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('[role=dialog]'));
      await page.keyboard.press('Escape');
      await settle();
      assert((await page.locator('.sheet-styled-box').count()) === 0, 'Escape left the sheet');
      // Popover: opens with the dialog focused, and Escape gives focus back.
      await visit('popover');
      const share = page.locator('.popover-styled-trigger');
      await share.click();
      await page.locator('.popover-styled-popover').waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('[role=dialog]'));
      await page.keyboard.press('Escape');
      await settle();
      assert((await focused()) === 'Share', `focus is on "${await focused()}" after Escape`);
      // Tooltip: focus from the keyboard shows it, and Escape hides it.
      await visit('tooltip');
      await page.locator('.tooltip-styled-trigger').first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await page.locator('[role=tooltip]:not([data-closed])').first().waitFor();
      await page.keyboard.press('Escape');
      await settle();
      assert((await page.locator('[role=tooltip]').count()) === 0, 'Escape left the tooltip');
      // PreviewTrigger: focus from the keyboard shows the card, and Escape hides it.
      await visit('preview-trigger');
      await page.locator('.preview-styled-link').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await page.locator('.preview-styled-card').waitFor();
      await page.keyboard.press('Escape');
      await settle();
      assert((await page.locator('.preview-styled-card').count()) === 0, 'Escape left the card');
      // Toast: a button adds one, and its close button removes it.
      await visit('toast');
      await page.locator('.toast-styled-trigger').first().click();
      const toast = page.locator('.toast-styled-toast');
      await toast.waitFor();
      await toast.getByRole('button', { name: 'Close' }).click();
      await settle();
      assert((await toast.count()) === 0, 'the close button left the toast');
    });
    await flow(
      '/ui: the pages of Collections have an anatomy picture and a styled example',
      async () => {
        for (const slug of [
          'list-box',
          'tabs',
          'tag-group',
          'grid-list',
          'menu',
          'combo-box',
          'autocomplete',
          'table',
          'tree',
          'navigation-tree',
          'virtualizer',
        ]) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              marks > 0 && marks === items,
              `/ui/${slug}: ${marks} callouts for ${items} listed pieces`,
            );
            await page.addScriptTag({ path: axe });
            // An option with a label and a description is named by its label alone and described
            // by the description, on purpose. axe compares the name with all the visible text of
            // the option and reports label-content-name-mismatch, which is a false positive for
            // it, so only those options are left out.
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run({
                include: ['article'],
                exclude: ['[role=option][aria-labelledby][aria-describedby]'],
              });
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow('/ui: Menu, ComboBox and Autocomplete open, filter, act and pick', async () => {
      const settle = () => page.waitForTimeout(800);
      const visit = async (slug) => {
        await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
        await settle();
      };
      const shown = (selector) =>
        page
          .locator(selector)
          .evaluateAll((items) =>
            items.filter((item) => item.offsetParent !== null).map((item) => item.textContent),
          );
      // Menu: ArrowDown opens it at the first item, Enter acts, and focus returns to the Button.
      await visit('menu');
      const names = () => page.locator('.menu-row span').allInnerTexts();
      assert((await names()).join() === 'Notes.txt,Budget.xlsx,Photos.zip', 'the rows start wrong');
      const actions = page.getByRole('button', { name: 'More actions for Notes.txt' });
      await actions.focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'menuitem');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await settle();
      assert((await names()).includes('Copy of Notes.txt'), 'Duplicate added no row');
      assert(
        (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ===
          'More actions for Notes.txt',
        'focus did not return to the Button',
      );
      // A menu that is open takes Escape, and the state demo follows its signal.
      await page.getByRole('button', { name: 'Open the second menu' }).click();
      await page.getByRole('menuitem', { name: 'Size' }).waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('[role=menu]'));
      await page.keyboard.press('Escape');
      await settle();
      assert(
        (await page.locator('p', { hasText: 'Second menu:' }).innerText()).includes(
          'Second menu: closed',
        ),
        'Escape left the signal open',
      );
      // A menu with a multiple selection stays open after a press.
      await page.getByRole('button', { name: 'Show', exact: true }).click();
      await page.getByRole('menuitemcheckbox', { name: 'City' }).click();
      await settle();
      assert(
        (await page.getByRole('menuitemcheckbox', { name: 'Role' }).count()) === 1,
        'the menu closed after a press',
      );
      assert(
        (await page.locator('.menu-view-list li').first().innerText()).includes('London'),
        'the list did not show the city',
      );
      await page.keyboard.press('Escape');
      // ComboBox: typing filters, Enter picks, and a reset gives the start state back.
      await visit('combo-box');
      const form = page.locator('form', { has: page.getByRole('combobox', { name: 'Country' }) });
      const country = form.getByRole('combobox');
      await country.click();
      await page.keyboard.type('jap');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      assert((await country.inputValue()) === 'Japan', 'Enter did not pick Japan');
      await form.getByRole('button', { name: 'Save' }).click();
      await settle();
      assert(
        (await form.locator('.ui-error').innerText()) === 'We do not ship to Japan yet.',
        'the error did not show',
      );
      await form.getByRole('button', { name: 'Reset' }).click();
      await settle();
      assert((await country.inputValue()) === '', 'Reset left the text');
      await country.click();
      await page.keyboard.type('ke');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await form.getByText('Sent country=ke.').waitFor({ timeout: 5000 });
      // Autocomplete: typing hides the items that do not match, and Enter acts on the active one.
      await visit('autocomplete');
      await page.getByRole('button', { name: 'Commands' }).click();
      await page.waitForFunction(() => document.activeElement?.matches('[role=dialog] input'));
      await page.keyboard.type('sa');
      await settle();
      assert(
        (await shown('[role=dialog] [role=menuitem]')).join() === 'Save',
        'the palette did not filter',
      );
      await page.keyboard.press('Enter');
      await settle();
      assert((await page.locator('[role=dialog]').count()) === 0, 'the palette stayed open');
      await page.getByText('Ran: save.').waitFor({ timeout: 5000 });
    });
    await flow('/ui: Table, Tree, NavigationTree, Virtualizer and Data use cases act', async () => {
      const settle = () => page.waitForTimeout(800);
      const visit = async (slug) => {
        await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
        await settle();
      };
      // Table: a selected row is deleted, and the count follows.
      await visit('table');
      const invoices = page.getByRole('grid', { name: 'Invoices' });
      await invoices.getByRole('checkbox', { name: 'Select Acme' }).click({ force: true });
      await page.getByRole('button', { name: 'Delete 1 selected' }).click();
      await page.getByText('3 invoices.').waitFor({ timeout: 5000 });
      assert((await invoices.getByText('Acme').count()) === 0, 'the row stayed');
      // Table: a long table renders a few of its rows.
      const long = await page
        .getByRole('grid', { name: '3000 orders' })
        .locator('tbody tr')
        .count();
      assert(long > 0 && long < 100, `the long table rendered ${long} rows`);
      // Tree: a press acts on a row, and the folder picker saves its choice.
      await visit('tree');
      await page
        .locator('.ui-stack', { hasText: 'Opened:' })
        .getByRole('row', { name: 'notes.txt' })
        .click();
      await page.getByText('Opened: notes.').waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: 'Open all' }).click();
      await page.getByRole('row', { name: 'Team' }).waitFor({ timeout: 5000 });
      await page.getByRole('row', { name: 'Team' }).click();
      await page.getByRole('button', { name: 'Save here' }).click();
      await page.getByText('Saved in: team.').waitFor({ timeout: 5000 });
      // NavigationTree: a link moves the current page.
      await visit('navigation-tree');
      const guide = page.getByRole('treegrid', { name: 'Guide sections' });
      await guide.getByRole('link', { name: 'Buttons' }).click();
      await page.getByText('Page: buttons.').waitFor({ timeout: 5000 });
      assert(
        (await guide.getByRole('link', { name: 'Buttons' }).getAttribute('aria-current')) ===
          'page',
        'the link is not the current page',
      );
      // Virtualizer: the list renders a few of its 10000 options.
      await visit('virtualizer');
      const options = await page
        .getByRole('listbox', { name: '10000 cities' })
        .getByRole('option')
        .count();
      assert(options > 0 && options < 100, `the long list rendered ${options} options`);
      // Data: the filter hides items and a move changes the tree.
      await visit('data');
      await page.getByLabel('Filter pets').fill('sn');
      await page.getByText('Shown: 1.').waitFor({ timeout: 5000 });
      await page.getByLabel('Filter pets').fill('');
      await page.getByRole('row', { name: 'Answer mail' }).click();
      await page.getByRole('button', { name: 'Move to Later' }).click();
      await page.getByText('Moved: mail to later.').waitFor({ timeout: 5000 });
    });
    await flow(
      '/ui: the pages of navigation, status and layout that are done have an anatomy picture and a styled example',
      async () => {
        const slugs = [
          'disclosure',
          'disclosure-group',
          'breadcrumbs',
          'toolbar',
          'meter',
          'progress-bar',
          'group',
        ];
        for (const slug of slugs) {
          for (const scheme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
            assert((await page.locator('.styled pre').count()) === 1, `/ui/${slug} shows no CSS`);
            const marks = await page.locator('.anatomy [data-mark]').count();
            const items = await page.locator('.anatomy-list li').count();
            assert(
              marks > 0 && marks === items,
              `/ui/${slug}: ${marks} callouts for ${items} pieces`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'));
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in /ui/${slug} in ${scheme}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: the accordion, the toolbar and the upload respond to keys and presses',
      async () => {
        const settle = () => page.waitForTimeout(600);
        const visit = async (slug) => {
          await page.goto(`${url}/ui/${slug}`, { waitUntil: 'load' });
          await page.waitForTimeout(1500);
        };
        const focused = () =>
          page.evaluate(() => (document.activeElement?.textContent ?? '').trim().slice(0, 30));
        // DisclosureGroup: a press opens one and closes the one that was open.
        await visit('disclosure-group');
        const steps = page.locator('.ui-accordion', { hasText: '1. Address' });
        const triggers = steps.locator('button.ui-disclosure-trigger');
        assert(
          (await triggers.nth(0).getAttribute('aria-expanded')) === 'true',
          'the first step does not start open',
        );
        await steps.getByRole('button', { name: 'Continue' }).click();
        await settle();
        assert(
          (await triggers.nth(0).getAttribute('aria-expanded')) === 'false',
          'step 1 stayed open',
        );
        assert(
          (await triggers.nth(1).getAttribute('aria-expanded')) === 'true',
          'step 2 did not open',
        );
        assert(
          (await focused()).startsWith('2. Payment'),
          `focus is on "${await focused()}" after Continue`,
        );
        // Without allowsMultipleExpanded, a press on another trigger closes the open one. The
        // presses go through the part, not a signal.
        const cards = page.locator('.group-styled-list .group-styled-trigger');
        const openCount = () =>
          cards.evaluateAll(
            (list) => list.filter((item) => item.getAttribute('aria-expanded') === 'true').length,
          );
        assert((await openCount()) === 1, 'the styled group does not start with one open');
        await cards.nth(1).click();
        await settle();
        assert((await openCount()) === 1, `${await openCount()} are open after one more press`);
        assert(
          (await cards.nth(1).getAttribute('aria-expanded')) === 'true',
          'the pressed item did not open',
        );
        await cards.nth(2).click();
        await settle();
        assert((await openCount()) === 1, `${await openCount()} are open after two presses`);
        // With allowsMultipleExpanded they add up.
        const every = page.locator('.ui-stack', { hasText: 'Expand all' });
        await every.getByRole('button', { name: 'Collapse all' }).click();
        await every.getByRole('button', { name: 'Setup', exact: true }).click();
        await every.getByRole('button', { name: 'Usage', exact: true }).click();
        await settle();
        assert(
          (await every.locator('p').last().innerText()).startsWith('2 of 3'),
          'two presses did not leave two open',
        );
        // Disclosure: Enter opens the terms, and the Accept button wakes up.
        await visit('disclosure');
        const terms = page.locator('.ui-stack', { hasText: 'Terms of use' });
        const accept = terms.getByRole('button', { name: 'Accept' });
        assert(await accept.isDisabled(), 'Accept starts enabled');
        await terms.getByRole('button', { name: 'Terms of use' }).focus();
        await page.keyboard.press('Enter');
        await settle();
        assert(!(await accept.isDisabled()), 'opening the terms did not enable Accept');
        await accept.focus();
        await page.keyboard.press('Enter');
        await settle();
        assert(
          (await focused()) === 'Accepted',
          `focus is on "${await focused()}" after Accept, not on the button`,
        );
        // unmount="offscreen" keeps the typed text across a collapse.
        const options = page.locator('.ui-stack', { hasText: 'Advanced options' });
        const section = options.getByRole('button', { name: 'Advanced options' });
        await section.click();
        await settle();
        await options.locator('input').fill('proxy:8080');
        await section.click();
        await settle();
        assert(
          (await section.getAttribute('aria-expanded')) === 'false',
          'the section stayed open',
        );
        await section.click();
        await settle();
        assert(
          (await options.locator('input').inputValue()) === 'proxy:8080',
          'the collapse lost the typed text',
        );
        // Toolbar: the arrow keys move focus and Home and End go to the ends.
        await visit('toolbar');
        const editor = page.locator('.ui-stack', { hasText: 'Hello' });
        await editor.getByRole('button', { name: 'Bold' }).focus();
        await page.keyboard.press('ArrowRight');
        assert((await focused()) === 'Italic', `ArrowRight went to "${await focused()}"`);
        await page.keyboard.press('End');
        assert(
          await editor.locator('input').evaluate((input) => input === document.activeElement),
          'End did not reach the field',
        );
        // Tab stops at one item, so Shift+Tab from the field leaves the toolbar.
        await page.keyboard.press('Shift+Tab');
        assert(
          !(await editor
            .locator('[role=toolbar]')
            .evaluate((bar) => bar.contains(document.activeElement))),
          'Shift+Tab stayed in the toolbar',
        );
        await editor.getByRole('button', { name: 'Larger' }).focus();
        await page.keyboard.press('Home');
        assert((await focused()) === 'Bold', `Home went to "${await focused()}"`);
        // Right to left: ArrowLeft moves to the next item.
        const arabic = page.locator('div[dir=rtl] [role=toolbar]');
        await arabic.getByRole('button').first().focus();
        await page.keyboard.press('ArrowLeft');
        assert(
          (await focused()) === (await arabic.getByRole('button').nth(1).innerText()),
          'ArrowLeft did not move on right to left',
        );
        // ProgressBar: two quick presses start one upload, and Cancel resets it.
        await visit('progress-bar');
        const upload = page.locator('.ui-stack', { hasText: 'Cancel' }).first();
        const bar = upload.locator('[role=progressbar]');
        await upload.getByRole('button', { name: 'Upload', exact: true }).dblclick();
        await page.waitForTimeout(800);
        const value = Number(await bar.getAttribute('aria-valuenow'));
        assert(value > 0 && value <= 30, `two timers ran: the value is ${value}`);
        await upload.getByRole('button', { name: 'Cancel' }).click();
        await settle();
        assert((await bar.getAttribute('aria-valuenow')) === '0', 'Cancel left the value');
        // The buttons keep focus when they are pressed with the keyboard.
        await upload.getByRole('button', { name: 'Upload', exact: true }).focus();
        await page.keyboard.press('Enter');
        assert((await focused()) === 'Upload', `focus is on "${await focused()}" after Upload`);
        await upload.getByRole('button', { name: 'Cancel' }).focus();
        await page.keyboard.press('Enter');
        await settle();
        assert((await focused()) === 'Cancel', `focus is on "${await focused()}" after Cancel`);
        // The fill has the width that --percentage says (64%, 38%, 72% and 94%).
        const fill = (selector) =>
          page.evaluate((query) => {
            const element = document.querySelector(query);
            return (
              (element.getBoundingClientRect().width /
                element.parentElement.getBoundingClientRect().width) *
              100
            );
          }, selector);
        const wide = await fill('.progress-styled-list .progress-styled-fill');
        assert(Math.abs(wide - 64) < 1, `the ProgressBar fill is ${wide}% wide, not 64%`);
        await visit('meter');
        const meterFill = await fill(".meter-styled-fill[data-level='high']");
        assert(Math.abs(meterFill - 72) < 1, `the Meter fill is ${meterFill}% wide, not 72%`);
        // Breadcrumbs: a press on a step cuts the path, and focus goes to the list of folders.
        await visit('breadcrumbs');
        const folders = page.locator('.ui-stack:has(nav[aria-label=Folder])');
        const trail = folders.locator('nav');
        await folders.getByRole('button', { name: 'Photos' }).click();
        await folders.getByRole('button', { name: 'Spring' }).click();
        await settle();
        assert((await trail.locator('li').count()) === 3, 'the path is not three steps');
        await trail.getByRole('link', { name: 'Photos' }).click();
        await settle();
        assert((await trail.locator('li').count()) === 2, 'a press on a step left the path');
        assert(
          await folders
            .locator('[role=group][tabindex="-1"]')
            .evaluate((list) => list === document.activeElement),
          'focus did not go to the list of folders',
        );
        // Group: the focus ring follows focus inside, and the disabled one says so.
        await visit('group');
        const frames = page.locator('.group-styled');
        assert(
          (await frames.nth(2).getAttribute('data-disabled')) !== null &&
            (await frames.nth(2).locator('input').isDisabled()),
          'the disabled group is not disabled',
        );
        assert((await frames.nth(1).getAttribute('data-invalid')) !== null, 'no data-invalid');
        await frames.nth(0).locator('input').focus();
        assert(
          (await frames.nth(0).getAttribute('data-focus-within')) !== null,
          'no data-focus-within with focus inside',
        );
        // Enter in the search field searches.
        const search = page.locator('.ui-stack:has(form)');
        await search.locator('input').fill('shoes');
        await page.keyboard.press('Enter');
        await settle();
        assert((await search.innerText()).includes('Searched for "shoes"'), 'Enter did not search');
      },
    );
    await flow(
      '/ui/styling: the styled examples follow the theme toggle, with no contrast violations',
      async () => {
        // The toggle of the site, not the system setting, picks the theme. Each system setting
        // meets both choices of the toggle.
        for (const system of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: system });
          await page.goto(`${url}/ui/styling`, { waitUntil: 'load' });
          for (const theme of ['light', 'dark']) {
            await page.evaluate((name) => {
              document.documentElement.dataset.theme = name;
            }, theme);
            // The examples animate their colors, so wait for the change to settle.
            await page.waitForTimeout(400);
            // The accent of the examples is a fill, so a selected item shows it behind its text.
            const fill = await page.evaluate(
              () =>
                getComputedStyle(document.querySelector('.styling-list-item[data-selected]'))
                  .backgroundColor,
            );
            assert(
              theme === 'dark' ? fill === 'rgb(111, 178, 230)' : fill === 'rgb(42, 118, 178)',
              `the selected item is ${fill} in the ${theme} theme with a ${system} system`,
            );
            await page.addScriptTag({ path: axe });
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(document.querySelector('article'), {
                runOnly: ['color-contrast'],
              });
              return result.violations.map((violation) => violation.id);
            });
            assert(
              violations.length === 0,
              `axe found in ${theme}/${system}: ${violations.join(', ')}`,
            );
          }
        }
        await page.emulateMedia({ colorScheme: null });
      },
    );
    await flow(
      '/ui: each page of the sidebar loads, with no accessibility violations',
      async () => {
        await page.goto(`${url}/ui/introduction`, { waitUntil: 'load' });
        const slugs = await page
          .locator('nav.sidebar a[href^="/ui"]')
          .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
        assert(slugs.length > 30, `the sidebar links to ${slugs.length} pages`);
        const found = [];
        for (const slug of slugs) {
          const response = await page.goto(`${url}${slug}`, { waitUntil: 'load' });
          if (response?.status() !== 200) {
            found.push(`${slug}: ${response?.status()}`);
            continue;
          }
          await page.addScriptTag({ path: axe });
          const violations = await page.evaluate(async () => {
            const result = await window.axe.run({
              include: ['article'],
              // A described option is named by its label alone, on purpose. axe reports
              // label-content-name-mismatch on it, which is a false positive.
              exclude: ['[role=option][aria-labelledby][aria-describedby]'],
            });
            return result.violations.map((violation) => violation.id);
          });
          if (violations.length > 0) {
            found.push(`${slug}: ${violations.join(', ')}`);
          }
        }
        assert(found.length === 0, `found:\n${found.join('\n')}`);
      },
    );
    await flow(
      '/docs and /ui: no scrollable region is out of reach of the keyboard, at 375px and 1280px',
      async () => {
        const found = [];
        for (const width of [375, 1280]) {
          await page.setViewportSize({ width, height: 800 });
          const slugs = new Set();
          for (const start of ['/docs/state', '/ui/introduction']) {
            await page.goto(`${url}${start}`, { waitUntil: 'load' });
            // The sidebar is a drawer at narrow widths, so read the links without clicking.
            const hrefs = await page
              .locator('nav.sidebar a[href^="/docs"], nav.sidebar a[href^="/ui"]')
              .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
            for (const href of hrefs) {
              slugs.add(href);
            }
          }
          slugs.add('/docs/');
          slugs.add('/ui/');
          assert(slugs.size > 60, `the sidebars link to ${slugs.size} pages`);
          for (const slug of slugs) {
            const response = await page.goto(`${url}${slug}`, { waitUntil: 'load' });
            if (response?.status() !== 200) {
              found.push(`${width}px ${slug}: ${response?.status()}`);
              continue;
            }
            await page.addScriptTag({ path: axe });
            const nodes = await page.evaluate(async () => {
              const result = await window.axe.run(document, {
                runOnly: ['scrollable-region-focusable'],
              });
              return result.violations.flatMap((violation) =>
                violation.nodes.map((node) => node.target.join(' ')),
              );
            });
            if (nodes.length > 0) {
              found.push(`${width}px ${slug}: ${nodes.join(', ')}`);
            }
          }
        }
        await page.setViewportSize({ width: 1280, height: 720 });
        assert(found.length === 0, `found:\n${found.join('\n')}`);
      },
    );
    await page.close();
  }
}
