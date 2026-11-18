---
id: style-files-spike
title: "Spike: component CSS as Vite stylesheets"
status: done
priority: must
type: experiment
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis: docs/roadmaps/brumate/nodes/style-files-spike/brief.md (Gates)
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-11-18
spent: 158000
owns:
  - docs/roadmaps/brumate/nodes/style-files-spike/**
shared: []
reserves: []
provides: []
depends_on: []
---

> 2026-11-18: refined from the notes of the style-files story. The story waits for this spike and its go.

# Spike: component CSS as Vite stylesheets

## Goal

Find out whether the scoped CSS of `.brm` components can leave the JS and the inline `<style>` in a build and go through Vite's CSS pipeline into cacheable `.css` assets, and which split works better: one stylesheet per bundle or one per component. Build a throwaway prototype, measure it, and write a design and a go or no-go for the style-files story.

## Why

See the style-files brief (`../style-files/brief.md`, "Why"): a server-rendered page sends its CSS twice (inline in the HTML and as `$$css` in render modules), neither copy is cached across pages, the project's PostCSS, Lightning CSS, Tailwind and autoprefixer never run on `.brm` styles, and the order of inline styles depends on how the user reached the page.

## Current state

- `compileStyles` (`packages/brumate/src/css.ts`) parses with postcss and scopes, synchronously. `minifyCSS` only strips comments and whitespace.
- Bundle CSS from `viteMetadata.importedCss` already reaches `bundleHints` (`packages/brumate/src/vite.ts`), and the server adds `<link rel="stylesheet">` (`runtime/server.ts`). A virtual `?brumate-style` module per component could join that path.
- The browser adds styles with `addStyle` and keeps them across navigations with `keepStyles` (`runtime/navigate.ts`).
- Vite's pipeline is async (`preprocessCSS`).

## Questions to answer

1. Can a build emit the component CSS as assets linked from the page, with dev unchanged (inline `<style>`, `textContent` swap on hot update)?
2. Do `${}` style variables, `targets`, block styles, `<style global>` and the scope attribute keep working? Which of them need changes, and how big?
3. One stylesheet per bundle, or one per component: bytes on first view, bytes on a second page view, number of requests.
4. Does a client navigation load the CSS of the next page before it swaps (no flash of unstyled content), and does rule order stop depending on the path the user took?
5. Can the project's PostCSS config run on scoped CSS in the build, given the async pipeline? Is that its own child?

## Gates (fixed before the run)

GOAL.md records size and does not gate on it (from 0.9.0), so the gates are about whether the design works:

- Go needs all of: (1) in a build of the website, the home and one docs page render with no inline component `<style>` and no `$$css` in JS, styles come from linked `.css` assets, and the brumate style tests pass on the prototype or have a named, small fix; (2) bytes sent for two page views in a row (home, then a docs page, cache warm for shared assets) are no larger than on `release/0.9`; (3) a client navigation between the two pages shows no unstyled frame.
- Anything else is a no-go, with the reason. A partial go (for example: build assets yes, PostCSS later) is allowed when the outcome names the split.

## Measure

- Website home and one docs page: HTML, JS, CSS bytes and gzip, first view and second view, on `release/0.9` and on the prototype.
- `pnpm bench --only brumate --scenario todos` before and after (nothing else running; never the full bench).

## Acceptance

- [ ] outcome.md has the answers to the five questions, the measurements with their commands and commits, the gate results, a design for the story's children (with sizes and the files each touches), and a go, partial go or no-go.
- [ ] The prototype lives on a local branch named in the outcome; it is not merged.
- [ ] Fast check passes on what is committed: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: time-boxed, about 0.4M tokens. Stop and write the outcome when the box runs out.
