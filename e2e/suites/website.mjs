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
      '/ui: the pages of Collections have an anatomy picture and a styled example',
      async () => {
        for (const slug of ['list-box', 'tabs', 'tag-group', 'grid-list']) {
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
            // The props table scrolls and reports scrollable-region-focusable on main, which the
            // node ui-scroll-focus owns. Drop the exclude with that node.
            // An option with a label and a description is named by its label alone and described
            // by the description, on purpose. axe compares the name with all the visible text of
            // the option and reports label-content-name-mismatch, which is a false positive here.
            const violations = await page.evaluate(async () => {
              const result = await window.axe.run(
                { include: ['article'], exclude: ['.props-table'] },
                { rules: { 'label-content-name-mismatch': { enabled: false } } },
              );
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
            const result = await window.axe.run(document.querySelector('article'));
            return result.violations.map((violation) => violation.id);
          });
          if (violations.length > 0) {
            found.push(`${slug}: ${violations.join(', ')}`);
          }
        }
        assert(found.length === 0, `found:\n${found.join('\n')}`);
      },
    );
    await page.close();
  }
}
