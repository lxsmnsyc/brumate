// The state that the parts of a Table share: its columns, its sort, and the cells of each row.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Key } from './collection.ts';

/** The column that a Table is sorted by, and the direction, as SortDescriptor of React Aria. */
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

/** The next sort for a press of a column, as useTableState of React Stately sorts. */
export function nextSort(current: SortDescriptor | null, column: Key): SortDescriptor {
  return {
    column,
    direction:
      current?.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}
