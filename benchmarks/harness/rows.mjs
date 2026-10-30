// The data of the rows scenario. Every app imports this file, so they all make the same rows,
// and the harness uses it to know what each click must show.

const ADJECTIVES = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy',
];
const COLOURS = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'white',
  'black',
  'orange',
  'gray',
];
const NOUNS = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard',
];

/** The label of the row with an ID. The same ID always has the same label. */
export function label(id) {
  return `${ADJECTIVES[id % ADJECTIVES.length]} ${COLOURS[id % COLOURS.length]} ${NOUNS[id % NOUNS.length]}`;
}

/** `count` rows with the IDs from `from` on. */
export function build(from, count) {
  const rows = [];
  for (let index = 0; index < count; index++) {
    rows.push({ id: from + index, label: label(from + index) });
  }
  return rows;
}

/** Every 10th row, from the first, with ` !!!` at the end of its label. */
export function update(rows) {
  const next = [];
  for (const [index, row] of rows.entries()) {
    next.push(index % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row);
  }
  return next;
}

/** The rows with the second and the 999th swapped, when there are that many. */
export function swap(rows) {
  if (rows.length < 999) return rows;
  const next = rows.slice();
  [next[1], next[998]] = [rows[998], rows[1]];
  return next;
}

/** The rows without the one with an ID. */
export function remove(rows, id) {
  const next = [];
  for (const row of rows) {
    if (row.id !== id) next.push(row);
  }
  return next;
}
