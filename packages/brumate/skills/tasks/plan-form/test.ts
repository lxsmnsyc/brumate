import { beforeEach, expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import PlanForm from './src/PlanForm.brm?brumate-server';

// Server function calls are answered in the test process, with the server code.
beforeEach(() => answerCalls());

// The open list is in a layer, outside the container.
const find = (selector: string) => document.querySelector<HTMLElement>(`[data-layer] ${selector}`);

function press(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

it('asks for a plan, then saves the chosen one with the server function', async () => {
  const page = await mount(PlanForm, {});
  page.submit('form');
  await page.waitFor(() => expect(page.text('.error')).toBe('Pick a plan'));
  expect(page.text('.result')).toBe('');

  const trigger = page.get('.trigger');
  trigger.focus();
  press(trigger, 'ArrowDown');
  await page.waitFor(() => expect(find('.pro')).not.toBeNull());
  const pro = find('.pro')!;
  pro.focus();
  press(pro, 'Enter');

  await page.waitFor(() => expect(page.text('.trigger')).toContain('Pro'));
  page.submit('form');
  await page.waitFor(() => expect(page.text('.result')).toBe('Saved: pro'));
  expect(page.text('.error')).toBe('');

  page.unmount();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});
