export async function steps({ page, url, step }) {
  await step(
    'TimeField: the arrow keys step the hour, digits type the minute, and p sets PM',
    async () => {
      await page.goto(`${url}/`);
      const segment = (type) => page.locator(`.pickup-input [data-type="${type}"]`);
      const waitState = (text) =>
        page.waitForFunction(
          (t) => document.querySelector('.pickup-state')?.textContent === t,
          text,
        );
      await segment('hour').focus();
      await page.keyboard.press('ArrowDown');
      await waitState('13:30');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type('45');
      await waitState('13:45');
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-type') === 'dayPeriod',
      );
      await page.keyboard.type('a');
      await waitState('01:45');
      await page.keyboard.type('p');
      await waitState('13:45');
    },
  );
}
