# Log: dock-canvas-outlines

- Moved installFlash to devtools-flash.ts. It returns `{ boxes, canvas }` so tests read the box list. devtools.ts only imports and calls it; the .flash CSS rules left its style string.
- Review round 1: boxes keep the element and a viewport rect, measured again in repaint on scroll and resize (page coordinates drifted for fixed elements). Scroll with no boxes returns early; fit() runs on resize and when drawing. heatOf renamed pickHeat.
- Reduced motion: no fade, full alpha until FLASH_MS (the old CSS did the same).
- The test DOM has no 2d context, so the fade test mocks getContext with a recorder.
- test/devtools.test.ts read `.flash`; changed that one test to check the canvas and that no `.flash` exists.
