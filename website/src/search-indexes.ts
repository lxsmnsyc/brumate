// The search indexes of the site, loaded once, the first time the command bar opens. Pages that
// never open it do not load them.

export interface Entry {
  page: string;
  pageTitle: string;
  heading: string;
  id: string;
  text: string;
}

const loaded: { docs?: Entry[]; ui?: Entry[] } = {};
let loading: Promise<void> | undefined;

/** Loads both indexes. Calls after the first wait for the same load. */
export function loadIndexes(): Promise<void> {
  loading ??= Promise.all([import('virtual:search-index'), import('virtual:ui-search-index')]).then(
    ([docs, ui]) => {
      loaded.docs = docs.index;
      loaded.ui = ui.index;
    },
  );
  return loading;
}

/** The entries of an index, or none while it loads. */
export function getIndex(which: 'docs' | 'ui'): Entry[] {
  return loaded[which] ?? [];
}
