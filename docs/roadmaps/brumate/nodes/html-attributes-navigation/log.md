# Log: html-attributes-navigation

- 2026-10-30: Test in packages/brumate/test/navigate.test.ts fails on main (`data-theme` is gone after a navigation).
- Site bug confirmed on main with the e2e step added to e2e/suites/website.mjs: "the theme is undefined after a link".
- Fix: the server writes `b-html` on `<html>` with the sent names. The client removes the names of the current root's `b-html` that the next page lacks, and sets the next page's attributes. No module state.
- Docs: website/docs/navigation.md, section "The attributes of `<html>`" (not in the brief's paths).
- Size: todos client JS 80.0 kB / 28.6 kB on main and on the branch at the benchmark's precision.
