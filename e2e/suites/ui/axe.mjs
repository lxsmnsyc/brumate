import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { assert } from '../../lib.mjs';

const axe = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/**
 * Loads axe-core into the page. The page requires Trusted Types, which refuses the text of a script
 * tag, so the source runs as an evaluation of the browser tools, which the policy does not cover.
 */
async function addAxe(page) {
  await page.evaluate(axe);
}

export async function steps({ page, url, step }) {
  await step('axe-core: an open menu has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.edit-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cut');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Email');
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      // An open menu is modal, so the rest of the page is inert. axe skips its
      // rules of the whole page while a dialog is open, but a menu is not a dialog, so the rules
      // that look for the main landmark, the first heading and content outside landmarks are
      // off here alone.
      const result = await window.axe.run(document, {
        rules: {
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
        },
      });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open select has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.pet-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Cat');
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      // As for a menu: the list of a select is modal and not a dialog, so axe's rules of the
      // whole page see the inert page. They are off here alone.
      const result = await window.axe.run(document, {
        rules: {
          'landmark-one-main': { enabled: false },
          'page-has-heading-one': { enabled: false },
          region: { enabled: false },
        },
      });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open combobox has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.city-input').click();
    await page.keyboard.type('l');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-activedescendant'));
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      // The list renders at the end of <body>, outside the landmarks, so the
      // rule "region" is off here alone. The list is not modal, so the page keeps its landmarks.
      const result = await window.axe.run(document, { rules: { region: { enabled: false } } });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: a tooltip, a toast and a preview have no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.toast-trigger').click();
    await page.waitForSelector('.toast');
    await page.locator('.author').hover();
    await page.waitForSelector('.author-card', { timeout: 3000 });
    await page.locator('.tip-trigger').hover();
    await page.waitForSelector('[role=tooltip]', { timeout: 3000 });
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      // A tooltip renders at the end of <body>, outside the landmarks. The
      // best-practice rule "region" asks for all text in landmarks, so it is off here alone.
      const result = await window.axe.run(document, { rules: { region: { enabled: false } } });
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open modal has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.delete-trigger').click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('confirm'));
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: an open popover has no violations', async () => {
    await page.goto(`${url}/`);
    await page.locator('.settings-trigger').click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('settings'));
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });

  await step('axe-core: the page has no violations', async () => {
    await page.goto(`${url}/`);
    // axe runs as a script of the page, which Playwright adds.
    await addAxe(page);
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document);
      return result.violations.map(
        (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
      );
    });
    assert(violations.length === 0, `axe found:\n${violations.join('\n')}`);
  });
}
