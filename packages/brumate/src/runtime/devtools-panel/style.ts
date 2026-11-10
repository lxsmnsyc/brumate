// The styles of the dock, inside its shadow root.

export const STYLE = `
:host { all: initial; }
.panel {
  --bg: #121113; --surface: #19181a; --raised: #222023; --hover: #2a282c; --line: #2f2c31;
  --text: #ece8e4; --dim: #a39a92; --faint: #6f6862; --accent: #ee7a3e;
  --blue: #7cb7ff; --purple: #c49bff; --green: #7fd99a; --yellow: #ffd166; --red: #ff7a7a;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647;
  display: flex; flex-direction: column; min-height: 160px; max-height: 90vh;
  background: var(--bg); color: var(--text); border-top: 1px solid var(--line);
  box-shadow: 0 -8px 32px #0007; font: 12px/1.5 system-ui, -apple-system, sans-serif;
  color-scheme: dark;
}
.resize { position: absolute; top: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; }
.top { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid var(--line); background: var(--surface); white-space: nowrap; overflow: hidden; }
.brand { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; letter-spacing: -0.01em; }
.brand i { display: inline-block; width: 18px; height: 18px; }
.chip { padding: 1px 7px; border-radius: 999px; background: var(--raised); color: var(--dim); font: 11px var(--mono); }
.chip.accent { background: #ee7a3e22; color: #ffb48a; }
.route { font: 12px var(--mono); color: var(--text); overflow: hidden; text-overflow: ellipsis; }
.stats { color: var(--dim); overflow: hidden; text-overflow: ellipsis; }
.spacer { flex: 1; }
button, select, input { font: inherit; color: inherit; }
button { background: none; border: 1px solid transparent; border-radius: 6px; padding: 2px 8px; cursor: pointer; }
button:hover { background: var(--hover); }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
button.tool { display: inline-flex; align-items: center; gap: 6px; border-color: var(--line); background: var(--surface); }
button.tool .icon { color: var(--dim); flex: none; }
button.tool:hover .icon { color: var(--text); }
button.tool.only { padding: 3px 5px; }
.link { display: inline-flex; align-items: center; gap: 4px; }
.link .icon { opacity: 0.7; }
button.tool[aria-pressed="true"] { border-color: var(--accent); background: #ee7a3e22; color: #ffb48a; }
select, input[type="search"] { background: var(--raised); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
.main { flex: 1; display: flex; min-height: 0; }
.nav { display: flex; flex-direction: column; gap: 1px; padding: 6px; width: 156px; flex: none; border-right: 1px solid var(--line); background: var(--surface); overflow: auto; }
.nav .tab { display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 4px 8px; color: var(--dim); }
.nav .tab { gap: 8px; }
.nav .tab .label { flex: 1; }
.icon { flex: none; }
.nav .tab .icon { color: var(--faint); transition: color 0.15s; }
.nav .tab:hover .icon { color: var(--dim); }
.nav .tab[aria-selected="true"] { background: var(--raised); color: var(--text); box-shadow: 0 0 0 1px var(--line); }
.nav .tab[aria-selected="true"] .icon { color: var(--accent); }
.badge { min-width: 16px; padding: 0 5px; border-radius: 999px; background: var(--raised); color: var(--dim); font: 10px/16px var(--mono); text-align: center; }
.badge:empty { display: none; }
.tab[aria-selected="true"] .badge { background: var(--hover); }
.badge.warn { background: #ffd16622; color: var(--yellow); }
.badge.error, .tab[aria-selected="true"] .badge.error { background: #e5484d; color: #fff; }
.error-message { margin: 0 0 8px; color: var(--red); font: 600 14px/1.4 var(--mono); white-space: pre-wrap; }
.error-row { display: block; width: 100%; text-align: left; padding: 6px 8px; border-radius: 6px; }
.error-row[aria-current="true"] { background: #e5484d14; box-shadow: 0 0 0 1px #e5484d40; }
.error-row .text { display: block; color: var(--text); font: 12px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.error-row .when { color: var(--faint); font-size: 11px; }
.code { margin: 6px 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #0d1117; overflow: auto; }
.code .twinkleplop { margin: 0; padding: 8px 0; font: 12px/1.6 var(--mono); background: none; white-space: normal; }
.code .l { display: block; padding: 0 12px 0 0; white-space: pre; min-height: 1.6em; }
.code .ln { display: inline-block; width: 44px; padding-right: 12px; text-align: right; color: var(--faint); user-select: none; }
.code .l.error-line { background: #e5484d24; }
.code .l.error-line .ln { color: var(--red); }
.code .error-mark { text-decoration: wavy underline #e5484d; text-underline-offset: 3px; }
.code pre.plain { margin: 0; padding: 8px 12px; font: 12px/1.6 var(--mono); white-space: pre; }
.frames { display: flex; flex-direction: column; gap: 1px; }
.frame { display: flex; gap: 10px; width: 100%; text-align: left; padding: 3px 8px; border-radius: 5px; font: 11.5px var(--mono); }
.frame .fn { color: var(--text); white-space: nowrap; }
.frame .where { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.frame.library .fn, .frame.library .where { color: var(--faint); }
.frame[aria-current="true"] { background: #ee7a3e14; box-shadow: 0 0 0 1px #ee7a3e40; }
.frame[aria-current="true"] .fn { color: #ffb48a; }
.body { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; }
.split { display: flex; height: calc(100% + 24px); margin: -12px -14px; }
.split > .list { width: 280px; flex: none; overflow: auto; border-right: 1px solid var(--line); padding: 8px; display: flex; flex-direction: column; gap: 1px; }
.split > .list input { margin-bottom: 6px; }
.split > .detail { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
h3 { margin: 14px 0 6px; font-size: 11px; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; }
.sub { color: var(--dim); font-weight: 400; }
.mono { font-family: var(--mono); }
.empty { color: var(--faint); padding: 16px 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; margin-bottom: 6px; }
.card { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.card .label { color: var(--dim); font-size: 11px; }
.card .value { font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.card .note { color: var(--faint); font-size: 11px; }
.rows { width: 100%; border-collapse: collapse; }
.rows th { text-align: left; color: var(--faint); font-weight: 500; font-size: 11px; }
.rows td, .rows th { padding: 4px 10px 4px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
.rows tr:hover td { background: #ffffff05; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; align-items: baseline; }
.kv > :nth-child(odd) { color: var(--dim); }
.pill { display: inline-block; padding: 0 7px; border-radius: 999px; font: 11px/18px var(--mono); background: var(--raised); color: var(--dim); white-space: nowrap; }
.pill.blue { background: #7cb7ff1f; color: var(--blue); } .pill.purple { background: #c49bff1f; color: var(--purple); }
.pill.green { background: #7fd99a1f; color: var(--green); } .pill.yellow { background: #ffd1661f; color: var(--yellow); }
.pill.red { background: #ff7a7a1f; color: var(--red); } .pill.accent { background: #ee7a3e22; color: #ffb48a; }
.pill .name { color: #ffc28f; }
.link { color: var(--blue); padding: 0; border: 0; font-family: var(--mono); text-align: left; }
.link:hover { background: none; text-decoration: underline; }
.tree-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; text-align: left; padding: 2px 6px; border-radius: 5px; }
.tree-row.component { font-weight: 600; margin-top: 4px; }
.tree-row .file { color: var(--faint); font: 11px var(--mono); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-row[aria-current="true"] { background: #ee7a3e14; box-shadow: 0 0 0 1px #ee7a3e40; }
.tree-row[aria-current="true"] > span:first-child { color: #ffb48a; }
.written { animation: flash 0.8s; }
@keyframes flash { from { background: #ffd16633; } to { background: transparent; } }
.slots td.name { color: #ffc28f; font-family: var(--mono); width: 1%; white-space: nowrap; }
.slots td.type { color: var(--faint); font-family: var(--mono); width: 1%; white-space: nowrap; }
.slot .value { font-family: var(--mono); cursor: text; border-bottom: 1px dotted var(--faint); }
.slot .value.fixed { cursor: default; border: 0; }
.slot input { font: 12px var(--mono); color: var(--text); background: #000; border: 1px solid var(--accent); border-radius: 4px; padding: 1px 6px; width: 100%; box-sizing: border-box; }
.filters label { display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border-radius: 999px; background: var(--raised); cursor: pointer; }
.entry td { font-family: var(--mono); }
.entry .time { color: var(--faint); white-space: nowrap; width: 1%; }
.kind-handler { color: var(--blue); } .kind-part { color: var(--green); } .kind-write { color: var(--yellow); } .kind-call { color: #ff9ecf; }
.bar-cell { width: 40%; min-width: 160px; }
.navigation { padding: 8px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
.navigation .routes { display: flex; flex-direction: column; gap: 3px; }
tr.large td, tr.busy td { color: var(--yellow); }
tr.ended td { color: var(--faint); }
.bar-track { position: relative; height: 12px; }
.bar { position: absolute; top: 2px; height: 8px; min-width: 3px; border-radius: 3px; background: var(--blue); }
.bar.failed { background: var(--red); }
.bar.render { background: var(--accent); } .bar.memo { background: var(--green); } .bar.body { background: var(--purple); } .bar.stream { background: var(--faint); }
tr.failed td:not(.bar-cell) { color: var(--red); }
.interaction { margin-bottom: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.run-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.run-head .what { font-weight: 600; }
.run-head .ref { color: var(--dim); font: 11.5px var(--mono); }
.run-row { display: grid; grid-template-columns: 170px minmax(0, 1fr) 90px; align-items: center; gap: 10px; font: 11.5px var(--mono); color: var(--dim); }
.run-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.run-row .took { text-align: right; color: var(--text); }
.track { position: relative; height: 14px; overflow: hidden; border-radius: 4px; background-color: #ffffff08; }
.ruler { position: relative; height: 16px; color: var(--faint); font: 10.5px var(--mono); }
.ruler span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
.ruler span:first-child { transform: none; }
.ruler span.end { transform: translateX(-100%); }
.seg { position: absolute; top: 3px; height: 8px; min-width: 2px; border-radius: 3px; }
.seg.wait { background: repeating-linear-gradient(45deg, var(--faint) 0 3px, transparent 3px 6px); }
.seg.run { background: var(--blue); }
.seg.async { background: #7cb7ff55; }
.seg.call { background: #ff9ecf88; }
.seg.server { background: #ff9ecf; }
.seg.update { background: var(--green); }
.seg.failed { background: var(--red); }
.legend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; color: var(--dim); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
pre.report { margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 11.5px/1.55 var(--mono); white-space: pre-wrap; }
.inspect-card { position: fixed; z-index: 2147483647; display: flex; flex-direction: column; gap: 5px; max-width: 340px; padding: 9px 11px; border: 1px solid var(--line, #2f2c31); border-radius: 10px; background: #19181aee; color: #ece8e4; font: 12px/1.4 system-ui, -apple-system, sans-serif; box-shadow: 0 10px 28px #0008; pointer-events: none; backdrop-filter: blur(6px); }
.inspect-card .card-head { display: flex; justify-content: space-between; gap: 12px; color: #ffb48a; }
.inspect-card .card-component { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.inspect-card .card-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.inspect-card .card-hint { margin-top: 2px; padding-top: 6px; border-top: 1px solid #2f2c31; color: #6f6862; font-size: 11px; }
.outline { position: fixed; pointer-events: none; border: 2px solid #ee7a3e; background: #ee7a3e22; border-radius: 3px; z-index: 2147483646; }
`;
