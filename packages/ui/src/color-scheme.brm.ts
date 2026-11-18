// The color scheme of the ColorScheme around a part, for a Button or a menu that changes it.
import { $getContext, $memo, $store } from 'brumate/signals';
import { ColorSchemeContext } from './contexts.ts';
import type { ColorSchemeChoice } from './color-scheme.ts';

/**
 * Reads the color scheme from the ColorScheme around the part: `value` is the choice (`light`,
 * `dark` or `system`), `resolved` is `light` or `dark` once the browser knows the preference of
 * the device, and `setValue` changes the choice. Call it at the top level of a script.
 */
export function colorScheme() {
  const given = $getContext(ColorSchemeContext, undefined);
  const state = given ? $store(given.state) : undefined;
  const value = $memo<ColorSchemeChoice>(state?.value ?? 'system');
  const resolved = $memo(state?.resolved);

  function setValue(next: ColorSchemeChoice) {
    given?.setValue(next);
  }

  return { value, resolved, setValue };
}
