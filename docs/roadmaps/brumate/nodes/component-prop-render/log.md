# Log: component-prop-render

- Read core-gaps.md section 2. The page state holds `$b.c(id)`, a stub that renders `''`. The page's root scope is in the state with its component ID, so its client entry loads with the page, and handlers and updates wait for it (`loadingCode`).
- Wrote the fixtures LateAs, lateAsPage, LateEach and lateEachPage, and two tests in test/resume.test.ts, "a component in a prop". Both time out in `waitFor` on main.
- Chose the compiler direction, with a registry in the core. Why:
  - The core cannot load a render module by ID and still render at once: the render has to be synchronous, and a load is not. The entry of the sender loads with the page, so the render function is there before an event runs.
  - A load by ID needs the bundles to hold the render module of each component that can be a value. Only the compiler of the sender knows that one is. The bundle of a root already imports what the entry of that root imports.
  - Core cost: a record, a loop in `loadModule` and a lookup in `dynamic` and `dynamicNodes`. Measured +50 bytes gzip.
- The entry of a component that reads a `.brm` import as a value, outside event, effect, client and server function code, imports its render module and exports `components`. That makes `clientCode` true, so a build keeps the entry. The render module sets `brumateId` on its function, so the core keys it by the ID that the stub carries.
- Updated the 23 render snapshots: each render module ends with the `brumateId` line.
