// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { compile } from '../../src/index.ts';

describe('the specificity of a scoped selector', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('lets a later global rule of equal written specificity override a scoped rule', () => {
    const result = compile(
      '<div class="card"><p class="note">Hi</p></div>\n<style>\n  .card .note { color: red; }\n</style>',
      { filename: 'Specific.brm' },
    );
    const scoped = result.plan.styles.css;
    const attribute = /:where\(\[(b-c-[\w-]+)\]\)/.exec(scoped)![1]!;
    document.body.innerHTML = `<div class="card" ${attribute}><p class="note" ${attribute}>Hi</p></div>`;
    const style = document.createElement('style');
    // The global rule comes after the scoped one, as a parent stylesheet loaded later does.
    style.textContent = `${scoped}\n.card .note { color: blue; }`;
    document.head.append(style);
    expect(getComputedStyle(document.querySelector('.note')!).color).toBe('blue');
  });
});
