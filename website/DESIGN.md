# Design language of the website

The rules that every page of the site follows. The tokens are CSS custom properties in [`src/styles.css`](./src/styles.css), with a light and a dark value for each color. Use a token, never a raw value, so both themes and later changes reach the page.

## Idea

The site is the proof of what brumate claims. A page shows what ships, what runs and what it costs, with numbers that the build measures. Motion explains a change of state: something arrives, something runs, something is left out. It never decorates.

## Color

| Token                             | Use                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--bg`                            | The page.                                                                                             |
| `--bg-elevated`                   | Cards, dialogs, code panels, the header button of search: what sits on top.                           |
| `--surface`, `--surface-strong`   | Wells, table heads, hover fills, inline code.                                                         |
| `--text`                          | Body text, headings, the fill of a primary button.                                                    |
| `--muted`                         | Secondary text: leads, captions, labels. Reaches 4.5:1 on `--bg`.                                     |
| `--subtle`                        | Placeholders, rules, icons that repeat a label. Never the only text of a thing, as it is under 4.5:1. |
| `--border`, `--border-strong`     | Lines between parts, and the edge of a control.                                                       |
| `--accent`                        | Lines, outlines, focus rings, large marks, the accent word of a display heading.                      |
| `--accent-strong`                 | Accent text, such as links and eyebrows.                                                              |
| `--accent-fill`, `--on-accent`    | A fill with text on it, such as a badge.                                                              |
| `--accent-tint`, `--cool-tint`    | A wash behind text: the active item of a list, a highlighted line.                                    |
| `--cool`, `--on-cool`             | The second color: what updates, as against what ships code.                                           |
| `--danger`, `--warn`, `--success` | Errors, warnings and passing checks only.                                                             |
| `--code-bg`                       | Code blocks.                                                                                          |

Orange means "code ships or runs here". Blue means "this value updates". A diagram that shows both uses them in this sense.

## Type

| Token                      | Value                | Use                                             |
| -------------------------- | -------------------- | ----------------------------------------------- |
| `--font`                   | Inter Tight          | All text.                                       |
| `--mono`                   | JetBrains Mono       | Code, file names, sizes, eyebrows, keys.        |
| `--text-xs` to `--text-xl` | 0.75 to 1.5rem       | Fixed steps for UI text.                        |
| `--text-2xl`               | fluid, up to 2.75rem | Section headings of marketing pages.            |
| `--text-display`           | fluid, up to 4.5rem  | The one heading of a landing page (`.display`). |

- Headings are weight 600 with negative letter spacing: -0.045em at display size, -0.035em at `--text-2xl`, -0.02em below.
- Sizes and other numbers are mono with `font-variant-numeric: tabular-nums`, so they do not shift as they count.
- One word of a display heading may take the accent color, in `<em>`. It keeps the face, weight and style of the heading: emphasis comes from color, not from a second typeface.
- The site uses two faces only. A serif or a script reads as editorial, which does not fit a tool.

## Shape and depth

- Radii: `--radius-sm` (6px) for small controls and inline code, `--radius` (10px) for buttons and fields, `--radius-lg` (18px) for cards and panels, `--radius-full` for pills.
- Shadows: `--shadow-sm` for cards at rest, `--shadow` for a hovered card or a panel, `--shadow-lg` for dialogs. A shadow means "above the page"; a part in the flow of the page has none.

## Motion

| Token             | Value                            | Use                                               |
| ----------------- | -------------------------------- | ------------------------------------------------- |
| `--duration-fast` | 120ms                            | Hover, press, color changes.                      |
| `--duration`      | 200ms                            | A state change: a tab, a toggle, an active item.  |
| `--duration-slow` | 320ms                            | Something that enters: a dialog, a panel, a step. |
| `--ease`          | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Every transition. It starts fast and settles.     |

- Animate `transform` and `opacity`. Do not animate layout.
- A button rises 1px on hover and presses to 0.98 on `:active`. An arrow (`.arrow`) moves 3px on hover.
- Things that enter rise 8px and fade in. Things that leave fade out, faster.
- Pages change with a view transition; the header stays in place.
- With `prefers-reduced-motion: reduce`, every animation and transition ends at once (a rule in `styles.css`). A demo that only makes sense in motion shows its end state instead.

## Shared pieces

These classes live in `styles.css`. Use them before you write new ones.

| Class                        | What it is                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.button`, `.button.primary` | A link or button styled as a button. One primary per view.                                                |
| `.arrow`                     | Adds a moving arrow after the text of a link.                                                             |
| `kbd`, `.kbd`                | A key of the keyboard.                                                                                    |
| `.eyebrow`                   | A mono label above a heading.                                                                             |
| `.display`                   | The heading of a landing page. Put the accent word in `<em>`.                                             |
| `.section-head`              | The head of a section of a marketing page: `.numeral` (a mono `01` after a rule), then an `h2` and a `p`. |
| `.card`                      | A raised surface for a demo or a group of facts.                                                          |

## Layout

- Content is at most `--page-width` (76rem) wide, with 1.5rem of padding on each side.
- Sections of a marketing page are 5rem apart, with a rule between them.
- The header is `--header-height` tall and sticky. Layers stack as `--z-header`, `--z-strip`, then `--z-overlay`.
- Decoration such as a glow may reach past the edge of the page. `body` clips it, so the page never scrolls sideways.

## Interaction

- Every control has the focus ring of `:focus-visible`: 2px of `--accent`, 2px away.
- ⌘K or Ctrl+K opens search anywhere, and so does `/` outside a field.
- A number on the page comes from the build, such as a size from `brumate inspect` or a script the page loaded. Do not write a number by hand.
