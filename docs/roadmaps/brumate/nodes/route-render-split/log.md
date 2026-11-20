# Log

- Moved the code with a line-range script, then fixed imports. `deferTarget` stays in server.ts: `handleRoute` and `handlePage` use it too.
- oxlint `import/no-cycle` flags route-render.ts <-> server.ts. The cycle is real: server.ts calls `renderRoute`, `renderError` calls `renderPage`, and the moved code uses the render core in server.ts. Every use runs after both modules load, so one disable comment on each import.
