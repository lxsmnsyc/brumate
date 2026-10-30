// The code samples and the measured sizes of the landing page of @brumate/ui.
import { highlight } from './repl/highlight.ts';

export const unstyled = highlight(
  `.button[data-pressed] {
  transform: translateY(1px);
}

.button[data-focus-visible] {
  outline: 2px solid var(--accent);
}`,
  'css',
);

export const usage = highlight(
  `<script>
  import { $signal } from 'brumate/signals';
  import Button from '@brumate/ui/Button.brm';

  let presses = $signal(0);
</script>

<Button onPress=(() => presses++)>
  Pressed {presses} times
</Button>`,
  'brm',
);

/**
 * The gzip JS that the first server render of a page loads, in kB, from
 * `node scripts/measure-ui-sizes.mjs`. The first row is the loader and the core, which every
 * page with a script loads. The other rows add the code of a part.
 */
export const sizes: { name: string; note: string; total: number }[] = [
  { name: 'No part', note: 'the loader and the core', total: 24.4 },
  { name: 'Checkbox', note: '', total: 30.0 },
  { name: 'Button', note: '', total: 29.5 },
  { name: 'Tabs', note: 'a list and two panels', total: 36.3 },
  { name: 'Dialog', note: 'closed', total: 40.2 },
  { name: 'Select', note: 'two options, closed', total: 51.6 },
];
