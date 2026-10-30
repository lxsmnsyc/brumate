# Log: html-attributes-navigation

- 2026-10-30: Test in packages/brumate/test/navigate.test.ts fails on main (`data-theme` is gone after a navigation).
- Site bug confirmed on main with the e2e step added to e2e/suites/website.mjs: "the theme is undefined after a link".
- Fix: module variable `sent` in navigate.ts holds the names that the last navigated page sent. A navigation removes those the next page lacks, then sets the next page's attributes.
- Design limit: the first page is not tracked. The THEME_SCRIPT has already set `data-theme` when the module runs, so a snapshot at load would count it as sent and remove it. The first navigation therefore removes nothing; later ones do.
- Docs: website/docs/navigation.md, section "The attributes of `<html>`" (not in the brief's paths).
- Size: todos client JS 80.0 kB / 28.6 kB on main and on the branch at the benchmark's precision.
