export interface Row {
  id: number;
  label: string;
}
export function label(id: number): string;
export function build(from: number, count: number): Row[];
export function update(rows: Row[]): Row[];
export function swap(rows: Row[]): Row[];
export function remove(rows: Row[], id: number): Row[];
