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
declare const __BRUMATE_HAS_TRIES__: boolean | undefined;
declare const __BRUMATE_HAS_FIELDS__: boolean | undefined;
declare const __BRUMATE_HAS_WINDOWS__: boolean | undefined;
declare const __BRUMATE_HAS_DYNAMIC__: boolean | undefined;
declare const __BRUMATE_HAS_ROUTES__: boolean | undefined;
declare const __BRUMATE_HAS_LOADING__: boolean | undefined;
declare const __BRUMATE_HAS_ROOT_WAIT__: boolean | undefined;
declare const __BRUMATE_HAS_SEARCH_PARAMS__: boolean | undefined;
declare const __BRUMATE_HAS_STORES__: boolean | undefined;
declare const __BRUMATE_HAS_BRIDGES__: boolean | undefined;
declare const __BRUMATE_HAS_MODULE_MEMOS__: boolean | undefined;
declare const __BRUMATE_HAS_SCRIPTS__: boolean | undefined;
declare const __BRUMATE_HAS_VIEW_TRANSITIONS__: boolean | undefined;
declare const __BRUMATE_HAS_PRINTED__: boolean | undefined;

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

/** `#try` blocks, whose `#catch` the browser renders. */
export const HAS_TRIES: boolean =
  typeof __BRUMATE_HAS_TRIES__ === 'undefined' || __BRUMATE_HAS_TRIES__;

/** Fields of an element `$bind`, which the core reads when the user typed before it loaded. */
export const HAS_FIELDS: boolean =
  typeof __BRUMATE_HAS_FIELDS__ === 'undefined' || __BRUMATE_HAS_FIELDS__;

/** `#for` lists with `window`. */
export const HAS_WINDOWS: boolean =
  typeof __BRUMATE_HAS_WINDOWS__ === 'undefined' || __BRUMATE_HAS_WINDOWS__;

/** Dynamic tags, which can name a component and pass it props. */
export const HAS_DYNAMIC: boolean =
  typeof __BRUMATE_HAS_DYNAMIC__ === 'undefined' || __BRUMATE_HAS_DYNAMIC__;

/** `$route` and `$navigation`, which the runtime provides. */
export const HAS_ROUTES: boolean =
  typeof __BRUMATE_HAS_ROUTES__ === 'undefined' || __BRUMATE_HAS_ROUTES__;

/** `#loading` blocks that the browser renders, which show their fallback while memos load. */
export const HAS_LOADING: boolean =
  typeof __BRUMATE_HAS_LOADING__ === 'undefined' || __BRUMATE_HAS_LOADING__;

/**
 * A browser render that waits at `await $memo`. A block outside every `#loading` then keeps what
 * it shows until the waits of its new body settle, as the server holds the page.
 */
export const HAS_ROOT_WAIT: boolean =
  typeof __BRUMATE_HAS_ROOT_WAIT__ === 'undefined' || __BRUMATE_HAS_ROOT_WAIT__;

/** `$searchParam`, whose changes of the URL the loader leaves to the page. */
export const HAS_SEARCH_PARAMS: boolean =
  typeof __BRUMATE_HAS_SEARCH_PARAMS__ === 'undefined' || __BRUMATE_HAS_SEARCH_PARAMS__;

/** Stores of `brumate/store`, which `$toStore` and `$store` use and the page state can hold. */
export const HAS_STORES: boolean =
  typeof __BRUMATE_HAS_STORES__ === 'undefined' || __BRUMATE_HAS_STORES__;

/** Stores of `bridge()`, which the page state holds. */
export const HAS_BRIDGES: boolean =
  typeof __BRUMATE_HAS_BRIDGES__ === 'undefined' || __BRUMATE_HAS_BRIDGES__;

/** Memos of a module that a component imports, which take the value of the server on resume. */
export const HAS_MODULE_MEMOS: boolean =
  typeof __BRUMATE_HAS_MODULE_MEMOS__ === 'undefined' || __BRUMATE_HAS_MODULE_MEMOS__;

/** `<script>` elements in markup, which the loader starts on their trigger. */
export const HAS_SCRIPTS: boolean =
  typeof __BRUMATE_HAS_SCRIPTS__ === 'undefined' || __BRUMATE_HAS_SCRIPTS__;

/** `viewTransition` and `viewTransitionName` attributes, which get a name while a transition runs. */
export const HAS_VIEW_TRANSITIONS: boolean =
  typeof __BRUMATE_HAS_VIEW_TRANSITIONS__ === 'undefined' || __BRUMATE_HAS_VIEW_TRANSITIONS__;

/**
 * Inserts where raw HTML can print between markers, which the page state reads back from the
 * page instead of holding the HTML. See `printedHTML`.
 */
export const HAS_PRINTED: boolean =
  typeof __BRUMATE_HAS_PRINTED__ === 'undefined' || __BRUMATE_HAS_PRINTED__;
