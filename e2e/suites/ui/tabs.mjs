import { assert } from '../../lib.mjs';

export async function steps({ page, url, step }) {
  await step('Tabs: Tab stops at the selected tab, and the arrow keys select', async () => {
    await page.goto(`${url}/`);
    await page.locator('.planet-tab >> text=Mercury').focus();
    const y = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Venus');
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The hottest.',
    );
    assert((await page.evaluate(() => window.scrollY)) === y, 'the arrow keys scrolled the page');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Earth');
    // Tab moves on into the panel, and Shift+Tab comes back to the selected tab.
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.classList.contains('planet-panel'));
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Earth');
    await page.locator('.planet-tab >> text=Mercury').click();
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The closest to the Sun.',
    );
    // The indicator is only in the selected tab, and it slides there from the last one.
    await page.locator('.planet-tab >> text=Venus').click();
    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('.planet-bar');
      return bars.length === 1 && bars[0].closest('.planet-tab')?.textContent === 'Venus';
    });
    assert(
      await page.evaluate(() => document.querySelector('.planet-bar').getAnimations().length === 1),
      'the indicator did not move',
    );
  });

  await step('Tabs: an indicator with a timing function that has commas slides', async () => {
    await page.goto(`${url}/`);
    // The value of the .ui-indicator rule of the website.
    await page.addStyleTag({
      content:
        '.planet-bar { transition-duration: 0.25s; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }',
    });
    await page.locator('.planet-tab >> text=Mercury').click();
    await page.waitForFunction(
      () => document.querySelector('.planet-panel')?.textContent === 'The closest to the Sun.',
    );
    await page.locator('.planet-tab >> text=Venus').click();
    await page.waitForFunction(() => document.querySelector('.planet-bar')?.getAnimations().length);
    const easing = await page.evaluate(
      () => document.querySelector('.planet-bar').getAnimations()[0].effect.getTiming().easing,
    );
    assert(easing === 'cubic-bezier(0.2, 0, 0, 1)', `the indicator eases with ${easing}`);
  });
}
