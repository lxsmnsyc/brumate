import { expect, it } from 'vitest';
import { wholeNodes } from '../src/runtime/nodes.ts';

it('moves only whole nodes at the top level', () => {
  expect(wholeNodes('<p>a</p><p>b')).toBe('<p>a</p>'.length);
  expect(wholeNodes('<br><p')).toBe('<br>'.length);
  expect(wholeNodes('<template><div>a</div>')).toBe(0);
  expect(wholeNodes('<template><template></template></template>')).toBe(42);
});

it('reads past a > in an attribute or a script', () => {
  expect(wholeNodes('<p title="a>b">x</p><p title="c>')).toBe('<p title="a>b">x</p>'.length);
  expect(wholeNodes('<script>if (a > b) {}')).toBe(0);
  const script = '<script>if (a > b) {}</script>';
  expect(wholeNodes(`${script}<template>`)).toBe(script.length);
});
