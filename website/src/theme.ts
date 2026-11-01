// The global stylesheet of the site, inlined into every page, so a page paints
// styled before any script runs.
import dark from '@twinkleplop/theme-github/dark?inline';
import light from '@twinkleplop/theme-github/light?inline';
import site from './styles.css?inline';

/** The `:root { … }` block of a theme, which holds its colors. */
function colors(css: string): string {
  const start = css.indexOf(':root');
  return css.slice(css.indexOf('{', start), css.indexOf('}', start) + 1);
}

// The dark colors apply with the dark theme, chosen or from the system.
const darkColors = colors(dark);

// The comments of the light theme are darker than GitHub's, so they reach a contrast of 4.5:1 on
// the background of a code block of this site.
const lightTheme = light.replace(/--twp-comment:\s*#6e7781/, '--twp-comment: #59636e');

const base = import.meta.env.BASE_URL;

/**
 * The fonts of the site, latin only, from `public/fonts`. They are SIL Open Font License fonts,
 * taken from Fontsource; each license is next to its file. Each face swaps in when it loads, so
 * text shows at once in the fallback.
 */
function face(family: string, file: string, weight: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${base}fonts/${file}') format('woff2')}`;
}

const fonts = [
  face('Inter Tight', 'inter-tight-latin-wght-normal.woff2', '100 900'),
  face('JetBrains Mono', 'jetbrains-mono-latin-wght-normal.woff2', '100 800'),
].join('');

export const STYLES = `<style>${lightTheme}:root[data-theme='dark']${darkColors}@media (prefers-color-scheme: dark){:root:not([data-theme='light'])${darkColors}}${fonts}${site}</style>`;
