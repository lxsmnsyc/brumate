# Outcome: style-files-spike

## Result

**Partial go.** Build assets: yes, with one stylesheet per route bundle and a shared chunk for what pages share. One stylesheet per component: no. The PostCSS and Lightning CSS pipeline is its own child.

- Prototype branch: `spike/style-files`, tip `078616fe`, based on `d713634e` (`release/0.9`). Local only, never merged.
- Measurements and commands: `log.md` in this folder.

## Gates

1. Website home and one docs page with linked `.css` assets, no inline component `<style>`, no `$$css` in JS, style tests passing or a named small fix: **met**. Both pages have `<link rel="stylesheet">` and no component `<style>`. `$$css` is gone from every site chunk (it stays in the REPL compiler, which compiles in dev mode). Two style tests fail because they assert the old `const $$css = "…"` output, and the fix is small: read the asset or the import. Five other failures in the full run were timeouts under load and passed on a second run.
2. Bytes for two page views in a row, no larger than `release/0.9`: **not met by the built design, met by the design we recommend.**
   - Per component, built: 192,721 B gzip against 189,381 B (+3,340 B, +1.8%), and 12 more requests on the first view.
   - One file per route, simulated: 189,961 B (+580 B).
   - One file per route plus a shared file, simulated: 189,085 B (-296 B).
   - The two simulated cases concatenate the prototype's real processed CSS. Vite has not built them yet, so this gate is met on a measurement of the design, not of a build of it.
3. A client navigation shows no unstyled frame: **met** with the wait for the next page's stylesheets (0 of 92 frames with a pending sheet at 400 ms of CSS delay; 24 of 92 without the wait).

Size is recorded, not a gate (GOAL.md, 2026-11-12). The todos bench is unchanged: JS before `load` is 5 files, 33.2 kB raw / 13.8 kB gzip on both commits.

## The five questions

1. **Can a build emit component CSS as linked assets, with dev unchanged?** Yes. The prototype changes only build output (`hideNames`). Dev keeps inline `<style>` and the `textContent` swap of `runtime/hot.ts`. The client build must emit the CSS of components that have no client code too, since the manifest drops them. The prototype emitted one asset per component for that reason, from `buildStart`.
2. **Do `${}` variables, `targets`, block styles, `<style global>` and the scope attribute keep working?** Yes, with no change. `compileStyles` still produces the CSS; variables are `var(--s-…)` values that the markup sets, targets and the scope attribute are decided in the compiler, and a component's blocks stay one stylesheet in source order. Only where the CSS text goes changes. Needed changes: the two tests above, and the check of `liveBlocks` styles, which write variables on elements and read no stylesheet text (this spike did not test it, so the tests child covers it).
3. **One stylesheet per bundle or per component?** Per bundle. Numbers are in the gate 2 list above and in `log.md`. A component's file gzips to about 640 B on average, so 12 files cost 7.6 kB where the inline copy cost about 4 kB inside the HTML, and the 5 shared components do not make up for it on a second page. Concatenation per route gains most of it back, and a shared file for the layout components gives the second view its saving. The request count grows by one or two, not twelve.
4. **Does a client navigation load the next page's CSS before the swap, and does rule order stop depending on the path?** Load: yes, with a wait added in `navigate.ts` before the swap: preload the new page's stylesheet links and await them. A link inserted in the body without it renders unstyled for the load time (24 frames in the control). Order: yes. The server writes the links in the render order of the page, and a navigation keeps the links in the body of the new route, so the order is the order of a full load. The inline path put a stylesheet in the head in the browser and the body on the server. One case stays open: a component first rendered by the browser (a client-only block) adds its link to the head with `addStyle`. In the build the loader should load the stylesheet with the chunk (the preload helper already adds `<link rel=stylesheet>` for a `.css` dependency), so the link is there before the component renders.
5. **Can the project's PostCSS config run on scoped CSS in a build, given the async pipeline? Its own child?** Yes, and yes. `compileStyles` stays synchronous; the async step is `preprocessCSS` inside `load` of a `?brumate-style` module, which Vite allows. A probe showed that PostCSS plugins run with the default transformer and Lightning CSS lowers nesting, media ranges and `inset` for `targets`; with `css.transformer: 'lightningcss'`, `preprocessCSS` did not run the PostCSS plugin in the probe. The recommended design (real CSS modules, below) avoids `preprocessCSS`, because Vite's own CSS plugin then runs PostCSS, Lightning CSS and the minifier in the order the project sets, so this stays a child that verifies the order on a real build. It is useful in dev too.

## Prior art

How other compilers send component CSS through Vite (all pinned):

- Svelte: the compiler returns the CSS, and the plugin appends `import "<file>.svelte?svelte&type=style&lang.css"` to the component's JS; a `load` hook returns the cached CSS for that id. Vite's CSS plugin does the rest, and the chunk's CSS reaches `importedCss`. [utils/compile.js](https://github.com/sveltejs/vite-plugin-svelte/blob/42e49ebcc77ad220bb0d4c4840f7053a850fab1e/packages/vite-plugin-svelte/src/utils/compile.js), [plugins/load-compiled-css.js](https://github.com/sveltejs/vite-plugin-svelte/blob/42e49ebcc77ad220bb0d4c4840f7053a850fab1e/packages/vite-plugin-svelte/src/plugins/load-compiled-css.js).
- Vue: `genStyleCode` writes `import "<file>.vue?vue&type=style&index=0&lang.css"` for each `<style>` block, so Vite treats it as a CSS file. [main.ts](https://github.com/vitejs/vite-plugin-vue/blob/68b8f6ed3b315f9683154349575f1b1c45cd6782/packages/plugin-vue/src/main.ts).
- Astro: styles are CSS modules the same way, and the build collects them per page in the SSR and prerender builds, ordering them by depth, then writes the links or inlines small ones into each page. The server needs a map from page to stylesheets because the SSR build drops CSS. [plugin-css.ts](https://github.com/withastro/astro/blob/01c942da6308d5b89bd5e3910559f7c255acae20/packages/astro/src/core/build/plugins/plugin-css.ts).
- Marko: `@marko/vite` makes virtual files next to the template (`.marko-virtual.css`) and writes a manifest that maps each template to its assets, which the server reads to link the page. [src/index.ts](https://github.com/marko-js/vite/blob/df354bd4c1e85db871c4ed3609f2e4dff6818a35/src/index.ts).

**The design copies Svelte and Vue** for the module (a `?brumate-style&lang.css` import in the build, so Vite's CSS pipeline runs on it and the chunk gets one CSS asset), **and Astro and Marko** for the link map (the server reads, at build time, which stylesheets each page and bundle needs, because the server build does not keep CSS and components with no client code have no chunk). The prototype built neither; it emitted one asset per component by its own name. That is why the per-bundle numbers are simulated.

## Design for the story's children

The story keeps `style-files` as one PR on `feat/style-files`. Children, in order:

1. **style-files-modules** (L). The build gives each component with CSS a `?brumate-style&lang.css` module that returns the scoped CSS (`load` in `vite.ts`, skipped by `transform`). The client bundle of each route imports the style module of every component it renders, including components with no client code (`manifest()` and `bundles()` in `vite.ts` add style-only members). The render and server modules stop writing `$$css`. Dev keeps `$$css`. Files: `packages/brumate/src/vite.ts`, `codegen/render.ts`, `codegen/server.ts`, `codegen/markup.ts`.
2. **style-files-links** (M). `bundleHints` and `ClientBundles.styles` carry each bundle's CSS and a per-component map (component ID to stylesheet URL). The server writes `<link rel="stylesheet">` in the head from that map for the components a page renders, in a fixed order, instead of `<style>` in the body at the first instance. Files: `vite.ts`, `runtime/server.ts`, `runtime/html.ts`. Needs child 1. Check that Vite splits the layout components into a shared chunk (the gate 2 numbers assume it); if it does not, add a `manualChunks` rule for them.
3. **style-files-navigation** (M). `navigate.ts` preloads and awaits the new page's stylesheets before the swap, and `keepStyles` and `replaceRoutes` handle `<link b-style>`. The loader loads a bundle's CSS with its chunk, and `addStyle` takes a URL. Files: `runtime/navigate.ts`, `runtime/client/page.ts`, `runtime/bundles.ts`, `runtime/loader.ts`. Needs child 2 for the markup it reads; its code can start from the prototype (`078616fe`).
4. **style-files-postcss** (M). Make Vite's pipeline run on scoped CSS in the build: project PostCSS config, Lightning CSS `targets`, the minifier. With real CSS modules this is mostly checking the order, and a test with a PostCSS plugin and a `targets` value. Add `minifyCSS` only for dev if still wanted. A docs page names what runs. Files: `vite.ts`, `css.ts`, `website/docs/**`. Independent of 2 and 3, needs 1.
5. **style-files-tests** (S). Rewrite the two style tests that read `$$css`; add a build test (no `$$css` in the chunks, no component `<style>`, assets named in the hints), an end-to-end test of a client navigation with a delayed stylesheet, and a test of `liveBlocks` variables. Files: `packages/brumate/test/styles.test.ts`, `test/styles/block-styles.test.ts`, `e2e/suites/**`. Rides with 1 to 3.

A changeset for `brumate` is a minor (new behavior of builds). The rule-order and unstyled-frame gains are in the changelog.

## Needs the maintainer

- Go or no-go on the partial go: per-bundle files with a shared chunk, not per-component files.
- Whether gate 2 is read on the measurement of the design (two simulated cases) or must wait for a built per-bundle prototype, which costs about one more node of this size. Child 1 and 2 would carry that check as their acceptance (two views no larger than `release/0.9` on the website).
