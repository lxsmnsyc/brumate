export type ColorSchemeChoice = 'light' | 'dark' | 'system';

/** The name of the cookie that keeps the choice. */
export const COLOR_SCHEME_COOKIE = 'color-scheme';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Returns the choice that a cookie value names, and `system` for anything else. */
export function parseColorScheme(raw: string | null | undefined): ColorSchemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/**
 * Returns the `document.cookie` string that keeps a choice for a year, for every path. The name is
 * written as it is, as `getCookie` reads it, so give a plain name. `secure` adds `Secure`, for https.
 */
export function colorSchemeCookie(name: string, choice: ColorSchemeChoice, secure = false): string {
  return `${name}=${choice}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Returns the script that puts the preference of the device on `<html>` before the first paint:
 * its class and its `color-scheme`. The nonce is for a Content Security Policy.
 */
export function colorSchemeScript(nonce?: string): string {
  const attribute = nonce && /^[\w+/=-]+$/.test(nonce) ? ` nonce="${nonce}"` : '';
  return `<script${attribute}>(function(){var d=document.documentElement;var c=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.classList.add(c);d.style.colorScheme=c})()</script>`;
}

/** Returns `light` or `dark` for a choice, with `system` following the preference of the device. */
export function resolveColorScheme(
  choice: ColorSchemeChoice,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (choice === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return choice;
}

/**
 * Returns the choice that the cookie of the request keeps, and `system` without one. Pass the
 * event from `getEvent()`, called in a `.brm` file: `readColorScheme(getEvent())`.
 */
export function readColorScheme(
  event: { getCookie(name: string): string | undefined },
  name: string = COLOR_SCHEME_COOKIE,
): ColorSchemeChoice {
  return parseColorScheme(event.getCookie(name));
}
