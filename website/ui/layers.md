# Layers

How overlays such as a [Popover](./popover.md), a [Modal](./modal.md) or a [Tooltip](./tooltip.md) stack above the page and above each other.

- An overlay renders a layer: an element of its own, with `data-layer`, which holds its panel.
- An overlay outside any other renders its layer at the end of `<body>`.
- An overlay that opens inside another one renders its layer at the end of the outer layer, not at the end of the page.

## What follows from it

- The inner overlay is above the outer one, since it comes after it, with no `z-index`.
- A press in the inner overlay is a press inside the outer one, so the outer one stays open. Escape closes the inner one first.
- The layer has `display: contents`, so it has no box of its own. A panel that scrolls, or that moves with a transform, does not clip or move the overlays inside it.
- A modal overlay makes the rest of the page `inert`, except its own layer and the layers inside it. A [ToastRegion](./toast.md) stays usable too.
- A page with its own `z-index` above the content, such as a sticky header, needs one on the overlays too.
