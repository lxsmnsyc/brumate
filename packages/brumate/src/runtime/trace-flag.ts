// Whether the build has the spans of the browser. The Vite plugin replaces the global with `true`
// in a client build whose entry passes `onTrace` to the loader, and with `false` in any other. A
// bundler then leaves out `trace-browser.ts` and every call into it. Without the plugin, as in a
// test that does not stub the global, it is off.

declare const __BRUMATE_TRACE__: boolean | undefined;

/** True when the page can send spans to `onTrace`. */
export const TRACE: boolean = typeof __BRUMATE_TRACE__ !== 'undefined' && __BRUMATE_TRACE__;
