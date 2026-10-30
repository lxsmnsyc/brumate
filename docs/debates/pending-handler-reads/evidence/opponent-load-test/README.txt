Does window `load` fire when the HTML response is cut mid-stream? (opponent, round 2)
Local node http server, chunked HTML; Playwright (playwright-core 1.64.1) driving Chromium.
- test.mjs: /drop sends 2 KB then res.socket.destroy() at 500 ms; /stall keeps the socket open 4 s then ends.
  headless shell (chromium_headless_shell-1248): /drop readyState "loading", no DOMContentLoaded, no load at 2 s and 5 s. /stall: load at 4000 ms. (result.txt)
- test-long.mjs: /drop observed 42 s: still "loading", no load. (result-long.txt)
- test-count.mjs: channel 'chromium' (new headless), one request only (no retry), /drop still "loading" at 12 s. (result-count.txt)
- test-fin.mjs: res.socket.end() (FIN) instead of destroy: still "loading" at 12 s. (result-fin.txt)
Conclusion: in Chromium a cut document stream leaves the document loading and fires no load event.
Not tested: Firefox, Safari, desktop Chrome with a window.
