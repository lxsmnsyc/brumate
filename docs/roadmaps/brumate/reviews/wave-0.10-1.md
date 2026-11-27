# 0.10.0, run 1 (2026-11-25 to 2026-11-26)

## Landed

- Story client-scripts, all 8 children on `feat/client-scripts`: default-scripts, dev-pages, nitro-scripts, examples-glue, nitro-prerender, script-nonce, client-scripts-docs, dev-client-entry. Story PR #534 into `release/0.10`, fresh review of the whole branch done and fixed (b039259d), full check passed. Waits for the maintainer.
- Batch 1 on `batch/brumate-release-0.10`: part-guides, clone-remaining-bodies, template-fragment-return, no-client-html, fixed-walks (not reproduced), loading-await-clone, state-dedupe-spike (result). Full check passed (two load timeouts pass alone). Cut PR #535 into `release/0.10`. Waits for the maintainer.
- Hotfix kept-page-nonce: PR #533 into `main` (0.9.1). Waits for the maintainer. Merge it before #534, whose docs say "from 0.9.1".

## Decisions (maintainer)

- i18n dropped: Paraglide fills the gap (decisions.md). images, content-mapper and markdown-plugin stay in the backlog (they need a package).
- brumate-node dropped: hosts are Nitro's; an own server uses `srvx/node` (decisions.md; reverses debate P8).
- state-dedupe-spike: go, as state-printed-html (L, should, 0.10.0) with the review's six fixes. partial-route-responses stays parked.

## Next

- After #533, #534 and #535 merge: merge `release/0.10` into the batch and into any open branch; set client-scripts done.
- Ready: state-printed-html (L, opus, bench lock), defer-in-browser-render (M), defer-visible-request (diagnose, after the story).
- 0.9.1 (from main, after the 0.10.0 nodes): memo-template-resume, svg-ambiguous-clone, kept-page-nonce (#533), then release-0.9.1. release-0.10 waits for release-0.9.1.

## Lessons

- Reviews found real bugs in every M+ node, most more than once. Nodes that touch the client runtime (no-client-html: 5 rounds) are L, not M.
- A squash with `reset --soft` onto a moved target reverted a landed node (memory: squash-onto-moved-target).
- Fresh worktrees need `pnpm build` before the website tests, or they fail on `brumate/highlight`.
