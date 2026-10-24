// The layers of overlays. Each floating part, such as a Dialog or a Popover, renders a layer, and
// an overlay that opens inside it mounts at the end of that layer, not at the end of <body>. See
// "Layers" in docs/proposals.md.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** The layer of a floating part: the ID of its element. */
export interface Layer {
  id: string;
}

/** The layer of the nearest floating part. `null` is the root layer, at the end of <body>. */
export const LayerContext: Context<Layer | null> = createContext<Layer | null>(
  'brumate-ui:layer',
  null,
);
