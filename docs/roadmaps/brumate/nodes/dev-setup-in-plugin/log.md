# Log

- Chose a virtual module `virtual:brumate/dev-start`. On the dev server, `resolveId` returns it for `brumate/loader` imported by anything but the generated start module and itself. It wraps `start` with `hotLoad` and installs the devtools with the arguments of the start module. A build never resolves it, so nothing ships.
- Tested with a pre plugin that resolves `brumate/loader` to the source for generated modules, because the package resolves to dist.
- Checked the website dev server: `/src/client.ts` imports the dev module, which has `hotLoad` and `installDevtools`.
- Review fix: an entry that still calls both itself would run them twice. `hotLoad` marks its result and returns a wrapped load as it is. `installDevtools` returns the installed state while its button is in the page.
