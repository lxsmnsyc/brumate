---
'@brumate/ui': patch
---

A `style` prop on Meter, ProgressBar, Popover, Tooltip, ModalOverlay and OverlayArrow no longer replaces the style of the part. Meter and ProgressBar keep `--percentage`, and the overlays keep their position. The prop can be a string or an object.
