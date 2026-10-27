// The tests of the list and tree data check the changes of list and tree data.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Data from './fixtures/data.brm?brumate-server';
import { pressWith } from './interact.ts';
import { buildNodes, changeChildren, insertAt, moveKeys, removeNodes } from '../src/data.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function data() {
  const page = await mount(Data, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof data>>;

const id = (item: { id: string }) => item.id;

it('inserts at an index, clamped to the ends', () => {
  expect(insertAt(['a', 'b'], 1, ['x', 'y'])).toEqual(['a', 'x', 'y', 'b']);
  expect(insertAt(['a'], 9, ['x'])).toEqual(['a', 'x']);
  expect(insertAt(['a'], -1, ['x'])).toEqual(['x', 'a']);
});

it('moves items together before or after another, in their order', () => {
  const items = ['a', 'b', 'c', 'd'].map((key) => ({ id: key }));
  const keys = (list: { id: string }[]) => list.map(id);
  expect(keys(moveKeys(items, 'd', ['a', 'b'], true, id))).toEqual(['c', 'd', 'a', 'b']);
  expect(keys(moveKeys(items, 'a', ['d', 'c'], false, id))).toEqual(['c', 'd', 'a', 'b']);
  // A move onto one of the moved items changes nothing.
  expect(keys(moveKeys(items, 'b', ['b'], true, id))).toEqual(['a', 'b', 'c', 'd']);
});

it('builds nodes with their parents, and changes children without copying the rest', () => {
  type File = { id: string; children?: File[] };
  const nodes = buildNodes<File>(
    [{ id: 'a', children: [{ id: 'b' }] }, { id: 'c' }],
    null,
    id,
    (file) => file.children,
  );
  expect(nodes[0]!.children![0]!.parentKey).toBe('a');
  expect(nodes[1]!.children).toBeNull();
  const changed = changeChildren(nodes, 'a', (children) => [
    ...children,
    { ...children[0]!, id: 'd' },
  ]);
  expect(changed[0]!.children!.map((node) => node.id)).toEqual(['b', 'd']);
  expect(changed[1]).toBe(nodes[1]);
  expect(
    removeNodes(changed, ['b'])
      .at(0)!
      .children!.map((node) => node.id),
  ).toEqual(['d']);
});

function pets(page: Page) {
  return JSON.parse(page.text('.pets-state')) as [string[], string[], string];
}

function fileRows(page: Page) {
  return [...page.get('.files').querySelectorAll('[role=row]')].map(
    (row) => `${JSON.parse(row.getAttribute('data-key')!)}@${row.getAttribute('aria-level')}`,
  );
}

it('changes the items of a list, which a GridList shows', async () => {
  const page = await data();
  expect(pets(page)[0]).toEqual(['Rex', 'Tom', 'Bob']);
  pressWith(page.get('.add'));
  await page.waitFor(() => expect(pets(page)[0]).toEqual(['Rex', 'Tom', 'Bob', 'Kit']));
  expect(page.get('.pet-Kit').textContent).toBe('Kit the cat');
  pressWith(page.get('.move-rex'));
  await page.waitFor(() => expect(pets(page)[0]).toEqual(['Tom', 'Bob', 'Rex', 'Kit']));
  pressWith(page.get('.rename-bob'));
  await page.waitFor(() => expect(page.get('.pet-Bob').textContent).toBe('Bob the shark'));
  // A removed item leaves the selection.
  pressWith(page.get('.pet-Tom'));
  await page.waitFor(() => expect(pets(page)[1]).toEqual(['Tom']));
  pressWith(page.get('.pet-Kit'));
  await page.waitFor(() => expect(pets(page)[1]).toEqual(['Tom', 'Kit']));
  pressWith(page.get('.remove-tom'));
  await page.waitFor(() => expect(pets(page)[1]).toEqual(['Kit']));
  pressWith(page.get('.remove-picked'));
  await page.waitFor(() => expect(pets(page)[0]).toEqual(['Bob', 'Rex']));
  expect(pets(page)[1]).toEqual([]);
  // The filter keeps the items whose name has the text.
  pressWith(page.get('.filter'));
  await page.waitFor(() => expect(pets(page)[0]).toEqual(['Bob']));
  expect(pets(page)[2]).toBe('o');
});

it('changes the nodes of a tree, which a Tree shows', async () => {
  const page = await data();
  expect(fileRows(page)).toEqual(['docs@1', 'cv@2', 'notes@1']);
  pressWith(page.get('.add-file'));
  await page.waitFor(() => expect(fileRows(page)).toEqual(['docs@1', 'cv@2', 'plan@2', 'notes@1']));
  pressWith(page.get('.move-notes'));
  await page.waitFor(() => expect(fileRows(page)).toEqual(['docs@1', 'notes@2', 'cv@2', 'plan@2']));
  pressWith(page.get('.rename-notes'));
  await page.waitFor(() => expect(page.get('.file-notes').textContent).toBe('todo.txt'));
  pressWith(page.get('.add-folder'));
  await page.waitFor(() => expect(fileRows(page).at(-1)).toBe('new@1'));
  expect(page.get('.file-new').getAttribute('aria-expanded')).toBe('true');
  // A removed node takes its children, and they leave the selection.
  pressWith(page.get('.file-cv'));
  await page.waitFor(() => expect(page.text('.files-state')).toBe('["cv"]'));
  pressWith(page.get('.remove-docs'));
  await page.waitFor(() => expect(fileRows(page)).toEqual(['new@1']));
  expect(page.text('.files-state')).toBe('[]');
});

it('moves a node with its children once, when the keys name both, or name a node twice', async () => {
  const page = await data();
  pressWith(page.get('.move-docs'));
  await page.waitFor(() => expect(fileRows(page)).toEqual(['notes@1', 'docs@1', 'cv@2']));
});
