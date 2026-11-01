// The code samples and the measured sizes of the landing page of @brumate/ui.
import { highlight } from './repl/highlight.ts';
import { gallery, sections } from './ui.ts';

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

/** The kB that a page loads for the loader and the core, before any part. */
export const core = sizes[0]!.total;

/** The kB that the part named `name` adds to the core, or null when the part is not measured. */
export function addedSize(name: string): number | null {
  for (const size of sizes) {
    if (size.name === name && size !== sizes[0]) {
      return size.total - core;
    }
  }
  return null;
}

/** The size of a part as the badge shows it, such as `+5.1 kB`, or an empty string. */
export function sizeLabel(name: string): string {
  const added = addedSize(name);
  return added === null ? '' : `+${added.toFixed(1)} kB`;
}

export interface Kind {
  title: string;
  cards: { title: string; summary: string; href: string; size: string }[];
}

/** The parts grouped by kind, in the order of the sidebar. */
export const kinds: Kind[] = [];
for (const section of sections) {
  if (section.title === 'Start') {
    continue;
  }
  const cards: Kind['cards'] = [];
  for (const entry of section.pages) {
    for (const card of gallery) {
      if (card.href === entry.slug) {
        cards.push({
          title: card.title,
          summary: card.summary,
          href: card.href,
          size: sizeLabel(card.title),
        });
      }
    }
  }
  if (cards.length > 0) {
    kinds.push({ title: section.title, cards });
  }
}
