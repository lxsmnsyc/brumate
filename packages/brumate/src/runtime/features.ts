// The features of the core that a build uses. Each is on, unless the build names it. The Vite
// plugin names them in the client build of an app, and turns off the features that none of its
// components use, so the bundler leaves out their code. They are globals that the plugin
// replaces, so the build of this package does not fold them.

declare const __BRUMATE_HAS_CHILDREN__: boolean | undefined;
declare const __BRUMATE_HAS_TEMPLATES__: boolean | undefined;
declare const __BRUMATE_HAS_TITLES__: boolean | undefined;
declare const __BRUMATE_HAS_BINDINGS__: boolean | undefined;

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
