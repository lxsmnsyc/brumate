# Log: style-files-postcss

- Vite 8.3.4 already runs the project's PostCSS and the minifier on the style modules (`?brumate-style&lang.css`), and the inline copy is cut from the built sheet, so both copies take the same transforms. No source change was needed.
- A test with a PostCSS plugin that repaints `red` shows the plugin in the sheet and in the inline copy (same text).
- `css.transformer: 'lightningcss'`: Vite runs `compileLightningCSS` instead of `compilePostCSS`, so PostCSS plugins do not run (Vite design, same for every CSS file). `css.lightningcss.targets` lowers in the transform, then the minifier (targets from `build.cssTarget`) joins `top/right/bottom/left` into `inset` again. Only `build.cssTarget: 'safari12'` plus the targets keeps them lowered.
- Marks survive both pipelines and the minifier (they sit in separate rules with different values). A PostCSS plugin that removes custom-property-only rules drops them; the minifier then also merges `.card` and `.tile`. The page falls back to a blocking link with no inline CSS and no mark in the sheet.
- Dev and a relative base wrote `$$css` inline with no PostCSS or Lightning CSS. Fixed in a second commit with `preprocessCSS` in `compileFile` and the compile option `css`.
