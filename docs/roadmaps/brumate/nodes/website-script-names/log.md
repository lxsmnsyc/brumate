# Log

- 2026-11-01: Not built yet on main. Every page has the footer meter (`data-network`, list hidden); only the home strip shows names.
- Baseline home page HTML: 126862 B raw, 30640 B gzip (inline map in head).
- Chose the JSON file: `script-names-<hash>.json` written by the `head` callback, linked from every head as `<link rel="script-names">`. NETWORK_SCRIPT stores the file name of each request and resolves the name at render; it fetches the map once, when a panel with a visible list renders (so also after a client navigation to the home page).
