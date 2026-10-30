# Log: runtime-event-cancel

- Checked main: not fulfilled. Three new tests failed on main (late `prevent` on click and submit, `bCancels`, click listener flags).
- Chosen shape: click and submit are never passive (they never scroll), plus a `bCancels` set on the event target that `onEvent` reads before any handler. The window capture listener of SubmitGuard is gone.
- The document always listens to `submit`, since a part may cancel a submit that no `b-on` names.
- Dropped by this: the guard no longer calls `stopImmediatePropagation`, so native submit listeners of the page still run on a cancelled submit (the `$action` listener checks `defaultPrevented`).
- todos (`node benchmarks/harness/run.mjs --only brumate --metrics dist --scenario todos`): main 79.6 kB / 28.4 kB gzip, branch 79.7 kB / 28.4 kB gzip. Within 0.3 kB.
