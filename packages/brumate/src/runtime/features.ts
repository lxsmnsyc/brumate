// The features of the core that a build uses. Each is on, unless the build names it. The Vite
// plugin names them in the client build of an app, and turns off the features that none of its
// components use, so the bundler leaves out their code. They are globals that the plugin
// replaces, so the build of this package does not fold them.

declare const __BRUMATE_HAS_CHILDREN__: boolean | undefined;
declare const __BRUMATE_HAS_TEMPLATES__: boolean | undefined;
declare const __BRUMATE_HAS_TITLES__: boolean | undefined;
declare const __BRUMATE_HAS_BINDINGS__: boolean | undefined;
declare const __BRUMATE_HAS_LATE_MARKUP__: boolean | undefined;
declare const __BRUMATE_HAS_BLOCKS__: boolean | undefined;
declare const __BRUMATE_HAS_LISTENERS__: boolean | undefined;
declare const __BRUMATE_HAS_ACTIONS__: boolean | undefined;
declare const __BRUMATE_HAS_CLIENT_HTML__: boolean | undefined;

/** Children that the browser renders with an export of their own, each time they are inserted. */
export const HAS_CHILDREN: boolean =
  typeof __BRUMATE_HAS_CHILDREN__ === 'undefined' || __BRUMATE_HAS_CHILDREN__;

/** `#template` values that the browser calls, such as a template that a prop holds. */
export const HAS_TEMPLATES: boolean =
  typeof __BRUMATE_HAS_TEMPLATES__ === 'undefined' || __BRUMATE_HAS_TEMPLATES__;

/** `<title>` elements in markup, which set the title of the page. */
export const HAS_TITLES: boolean =
  typeof __BRUMATE_HAS_TITLES__ === 'undefined' || __BRUMATE_HAS_TITLES__;

/** `$bind` that a component passes to another, which the page state can hold. */
export const HAS_BINDINGS: boolean =
  typeof __BRUMATE_HAS_BINDINGS__ === 'undefined' || __BRUMATE_HAS_BINDINGS__;

/**
 * Markup that comes into the page after it loads, from others than the core: the bodies of
 * `#loading` and `#defer`, the items of a list that streams, and the pages of client navigation.
 * Without it, the core finds every marker in the markup that it reads or inserts itself.
 */
export const HAS_LATE_MARKUP: boolean =
  typeof __BRUMATE_HAS_LATE_MARKUP__ === 'undefined' || __BRUMATE_HAS_LATE_MARKUP__;

/** `$client` callbacks and `#defer` blocks, which start on a trigger. */
export const HAS_BLOCKS: boolean =
  typeof __BRUMATE_HAS_BLOCKS__ === 'undefined' || __BRUMATE_HAS_BLOCKS__;

/** Handlers of the window or the document. */
export const HAS_LISTENERS: boolean =
  typeof __BRUMATE_HAS_LISTENERS__ === 'undefined' || __BRUMATE_HAS_LISTENERS__;

/** Forms of an `$action`, which send their data with `fetch`. */
export const HAS_ACTIONS: boolean =
  typeof __BRUMATE_HAS_ACTIONS__ === 'undefined' || __BRUMATE_HAS_ACTIONS__;

/**
 * Markup that the browser renders as HTML, not as a clone of a template. Without it, the core
 * indexes each insert at once, and HTML holds no places for clones.
 */
export const HAS_CLIENT_HTML: boolean =
  typeof __BRUMATE_HAS_CLIENT_HTML__ === 'undefined' || __BRUMATE_HAS_CLIENT_HTML__;
