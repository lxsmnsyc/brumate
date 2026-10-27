// Whether a field has a description. The server writes the input of a field before it reaches
// the Text with slot="description", so it names the ID of the description in aria-describedby
// either way. When the browser is idle, the field checks that the description is there, and
// leaves the ID out when it is not, after the first render.
import { $client, $signal } from 'brumate/signals';

/** True until the browser finds no element with the ID. */
export function described(id: string) {
  let present = $signal(true);

  $client(() => {
    present = document.getElementById(id) !== null;
  }, 'idle');

  return { present };
}
