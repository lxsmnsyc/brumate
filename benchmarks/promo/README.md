# Promotional images

HTML layouts for the images that announce a release. Edit a layout, then render it:

```bash
node harness/promo.mjs                 # every layout
node harness/promo.mjs features.html   # one layout
```

Run it from `benchmarks/`, after `pnpm install`. It uses the Chrome that the benchmarks use, writes a PNG next to each layout at twice its size, and fails when text or an element spills out of its tile or card. Git ignores the PNGs.

| Layout            | Image                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `benchmarks.html` | Six charts of `pnpm bench` against Marko 6, Qwik 1 and Qwik 2, with brumate highlighted. |
| `features.html`   | A grid of the features of a release, with the version in the middle tile.                |

- The numbers of `benchmarks.html` are written in its script, in `charts`. Copy them from the report of a run, and update the versions and the machine in the footnote.
- Each tile of `features.html` takes its place in the grid from its `grid-area`. The grid has 6 columns and 4 rows, and every cell needs a tile.
