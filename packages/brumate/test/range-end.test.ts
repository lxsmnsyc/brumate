// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { rangeEnd } from '../src/runtime/client/blocks.ts';

it('ends the range at the marker that closes it, past nested ranges', () => {
  const root = document.createElement('div');
  root.innerHTML = 'Text <!--b1:0--><!--b1:1-->x<!--/b1:1--><!--/b1:0--> after';
  const start = root.childNodes[1] as Comment;
  expect(rangeEnd(start)).toBe(root.childNodes[5]);
});

it('says why the end marker is missing when a <p> closed around a <div>', () => {
  // The end marker is in another parent, as the browser's parser leaves it for `<p><div></div></p>`.
  const root = document.createElement('div');
  root.innerHTML = '<p>Text <!--b1:0--></p><div>x</div><!--/b1:0-->';
  const start = root.querySelector('p')!.lastChild as Comment;
  expect(() => rangeEnd(start)).toThrow(/Missing end marker for <!--b1:0-->.*<p>/);
});
