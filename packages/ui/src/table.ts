// The state that the parts of a Table share: its columns, its sort, and the cells of each row.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Key } from './collection.ts';

/** The column that a Table is sorted by, and the direction. */
export interface SortDescriptor {
  column: Key;
  direction: 'ascending' | 'descending';
}

/** A column of a Table, which its Column gives as it renders. */
export interface TableColumn {
  id: Key | undefined;
  isRowHeader: boolean;
}

/** What a Table gives its parts. */
export interface TableState {
  /** The columns, in order. Each Column adds itself as it renders, before the rows. */
  columns: TableColumn[];
  sortDescriptor: SortDescriptor | null;
  /** Sorts by a column: ascending, or descending when it is sorted ascending already. */
  sort: (column: Key) => void;
  /** Whether every row that can be selected is, and whether some are, for the box in the header. */
  selectAll: { all: boolean; some: boolean };
  toggleAll: () => void;
  /** The data of the rows, when the Table has `items`, which its TableBody renders. */
  items: readonly { id: Key }[] | undefined;
  /** The height of a row in pixels when only the rows in view render, else none. */
  windowHeight: number | undefined;
}

export const TableContext: Context<TableState | null> = createContext<TableState | null>(
  'brumate-ui:table',
  null,
);

/** What a Row gives its Cells: the place of the next cell. */
export interface TableRowState {
  cells: { count: number };
}

export const TableRowContext: Context<TableRowState | null> = createContext<TableRowState | null>(
  'brumate-ui:table-row',
  null,
);

/** The next sort for a press of a column. */
export function nextSort(current: SortDescriptor | null, column: Key): SortDescriptor {
  return {
    column,
    direction:
      current?.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

/** A size of a column: pixels, a percentage such as `'25%'`, or a fraction such as `'1fr'`. */
export type ColumnSize = number | `${number}%` | `${number}fr`;

/** What a ResizableTableContainer gives a Table and its columns. */
export interface TableResizeState {
  /** The widths of the columns in pixels, by key, once a resize starts. */
  widths: Record<string, number>;
  /** The key of the column that resizes, as written by `keyAttribute`. */
  resizing: string | null;
  start: (key: string) => void;
  resize: (key: string, width: number) => void;
  end: () => void;
}

export const TableResizeContext: Context<TableResizeState | null> =
  createContext<TableResizeState | null>('brumate-ui:table-resize', null);

/** The CSS width of a column size. A fraction leaves the column to share the rest. */
export function cssWidth(size: ColumnSize | null | undefined): string | undefined {
  if (typeof size === 'number') {
    return `${size}px`;
  }
  return size && size.endsWith('%') ? size : undefined;
}

/** A width in pixels kept between the least and the most of a column, in pixels. */
export function clampWidth(width: number, min: number, max: number): number {
  return Math.min(Math.max(width, min), max);
}

/** What a Column gives a ColumnResizer in it: its key, and the ID of its header. */
export interface ColumnState {
  key: string;
  headerId: string;
  minWidth: number;
  maxWidth: number;
  /** The width in pixels that its props give it, when they give one. */
  width: number | undefined;
}

export const ColumnContext: Context<ColumnState | null> = createContext<ColumnState | null>(
  'brumate-ui:column',
  null,
);
