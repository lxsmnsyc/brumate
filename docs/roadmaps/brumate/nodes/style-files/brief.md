---
id: style-files
title: Component CSS as Vite stylesheets in builds
status: todo
priority: should
type: story
story:
early: false
outline: true
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

> 2026-11-12: should in 0.9.0 (docs/debates/0.9.0-cut/debate.md), the reserve if a must feature slips. The gated spike comes first. Size is recorded, not a gate (GOAL.md, Constraints).

# Component CSS as Vite stylesheets in builds

## Goal

In a build, the scoped CSS of components goes through Vite's CSS pipeline into cacheable `.css` assets, instead of a `$$css` string in each module and an inline `<style>` in each page. Dev keeps inline `<style>` and the `textContent` swap for hot updates.

## Why (2026-11-12 review of the style path)

- A page the server renders sends the CSS twice: inline in the HTML, and as `$$css` in the render module of any component the browser can render. Neither copy is cached across pages.
- `compileStyles` (`packages/brumate/src/css.ts`) only parses with postcss and scopes. The project's `postcss.config`, Lightning CSS targets, Tailwind and autoprefixer never run on `.brm` styles. `minifyCSS` only removes comments and whitespace.
- Inline styles land in the body at the first instance on the server, and at the end of the head in the browser (`addStyle`, `keepStyles` in `runtime/navigate.ts`), so the order of equal-specificity rules can depend on how the user reached the page.

## Notes for refinement

- Start with a spike, gated: size of the website home (HTML, JS, CSS, gzip) and the todos bench before and after, and one stylesheet per bundle vs one per component. Size comes first (GOAL constraints).
- The links already exist: bundle CSS from `viteMetadata.importedCss` reaches `bundleHints` (`vite.ts`) and the server adds `<link rel="stylesheet">` (`runtime/server.ts`). A virtual `?brumate-style` module per component could join that path.
- `${}` variables, `targets`, block styles and `<style global>` keep working. Running the pipeline on scoped CSS may be its own child, useful in dev too.
- The pipeline is async (`preprocessCSS`); `compileStyles` is sync, as are Sass and Less there.
