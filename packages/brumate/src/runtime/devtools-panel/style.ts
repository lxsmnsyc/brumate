// The styles of the dock, inside its shadow root.

export const STYLE = `
:host { all: initial; }
.panel {
  --bg: #121113; --bg2: #161517; --surface: #161517; --raised: #1d1c1f; --hover: #232125;
  --line: #29272b; --line2: #36333a;
  --text: #ece8e4; --dim: #a39a92; --faint: #6f6862;
  --accent: #ee7a3e; --accent-text: #ffb48a; --sel: #ee7a3e14; --ring: #ee7a3e47;
  --blue: #7cb7ff; --purple: #c49bff; --green: #7fd99a; --yellow: #ffd166; --red: #ff6b6b; --pink: #ff8fc8;
  --mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
  --ease: cubic-bezier(.2, .8, .2, 1);
  position: fixed; z-index: 2147483647; display: flex; flex-direction: column;
  background: var(--bg); color: var(--text); transition: transform 0.26s var(--ease);
  font: 12.5px/1.5 system-ui, -apple-system, sans-serif; font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased; color-scheme: dark;
}
.panel.bottom { left: 0; right: 0; bottom: 0; height: var(--h, 340px); min-height: 160px; max-height: 90vh; box-shadow: 0 -1px 0 var(--line2), 0 -24px 48px -24px #0009; }
.panel.right { top: 0; right: 0; bottom: 0; width: var(--w, 480px); min-width: 340px; max-width: 70vw; box-shadow: -1px 0 0 var(--line2), -24px 0 48px -24px #0009; }
.panel.closed { transform: translateY(100%); pointer-events: none; }
.panel.right.closed { transform: translateX(100%); }
.panel.dragging { transition: none; }
.edge { position: absolute; z-index: 2; touch-action: none; }
.panel.bottom .edge { left: 0; right: 0; top: -3px; height: 7px; cursor: ns-resize; }
.panel.right .edge { top: 0; bottom: 0; left: -3px; width: 7px; cursor: ew-resize; }
.edge::after { content: ""; position: absolute; inset: 3px 0; background: var(--accent); opacity: 0; transition: opacity 0.15s; }
.panel.right .edge::after { inset: 0 3px; }
.edge:hover::after, .panel.dragging .edge::after { opacity: 0.7; }
.edge:focus-visible { outline: none; }
.edge:focus-visible::after { opacity: 1; }
.head { display: flex; align-items: center; gap: 4px; height: 42px; padding: 0 8px 0 12px; border-bottom: 1px solid var(--line); flex: none; }
.brand { display: flex; align-items: center; gap: 8px; padding-right: 12px; margin-right: 4px; height: 20px; border-right: 1px solid var(--line); }
.brand i { display: inline-block; width: 16px; height: 16px; }
.brand b { font-weight: 600; letter-spacing: -0.01em; }
.ver { font: 11px/18px var(--mono); padding: 0 6px; border-radius: 5px; background: var(--hover); color: var(--dim); }
.ws { position: relative; display: flex; gap: 2px; }
.ws button { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px; border-radius: 7px; border: 0; color: var(--dim); font-weight: 500; transition: color 0.15s; }
.ws button:hover { background: none; color: var(--text); }
.ws button[aria-selected="true"] { color: var(--text); }
.ws .ind { position: absolute; top: 0; left: 0; width: 0; height: 28px; border-radius: 7px; background: var(--hover); box-shadow: inset 0 0 0 1px var(--line2); transition: left 0.25s var(--ease), width 0.25s var(--ease); }
.ws .c { font: 10.5px/16px var(--mono); color: var(--faint); }
.ws .c:empty { display: none; }
.ws .c.red { color: var(--red); }
.grow { flex: 1; }
.head button.cmd { display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 5px 0 10px; width: 220px; border: 0; border-radius: 8px; background: var(--bg2); box-shadow: inset 0 0 0 1px var(--line); color: var(--faint); margin-right: 4px; transition: box-shadow 0.15s, color 0.15s; }
.head button.cmd:hover { box-shadow: inset 0 0 0 1px var(--line2); color: var(--dim); }
.cmd .t { flex: 1; text-align: left; }
kbd { font: 10.5px/18px var(--mono); min-width: 18px; text-align: center; padding: 0 4px; border-radius: 5px; background: var(--hover); color: var(--dim); }
.head button.tbtn { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 7px; color: var(--dim); transition: background 0.15s, color 0.15s; }
.head button.tbtn:hover { background: var(--hover); color: var(--text); }
.head button.tbtn[aria-pressed="true"] { background: var(--sel); color: var(--accent-text); box-shadow: inset 0 0 0 1px var(--ring); }
.panel.right .cmd { width: 28px; padding: 0; justify-content: center; }
.panel.right .cmd .t, .panel.right .cmd kbd, .panel.right .ws .l, .panel.right .brand b { display: none; }
.foot { display: flex; align-items: center; gap: 16px; height: 26px; padding: 0 14px; border-top: 1px solid var(--line); color: var(--faint); font: 11px var(--mono); flex: none; overflow: hidden; white-space: nowrap; }
.foot b { color: var(--dim); font-weight: 400; }
.panel.right .foot span:nth-child(n+4):not(:last-child) { display: none; }
.live { display: inline-flex; align-items: center; gap: 6px; }
.live i { width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
.live.paused i { background: var(--faint); }
.scrim { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: start center; padding-top: 14vh; background: #0a090b99; backdrop-filter: blur(2px); animation: fade 0.15s ease-out; }
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { transform: translateY(8px) scale(0.985); opacity: 0; } }
.pal { --bg: #121113; --raised: #1d1c1f; --hover: #232125; --line: #29272b; --line2: #36333a; --text: #ece8e4; --dim: #a39a92; --faint: #6f6862; --mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace; width: min(580px, calc(100vw - 32px)); background: var(--bg); color: var(--text); border-radius: 14px; box-shadow: 0 0 0 1px var(--line2), 0 30px 80px #000c; overflow: hidden; font: 12.5px/1.5 system-ui, -apple-system, sans-serif; color-scheme: dark; animation: rise 0.2s var(--ease, ease-out); }
.pal .in { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 50px; border-bottom: 1px solid var(--line); color: var(--faint); }
.pal input { flex: 1; min-width: 0; background: none; border: 0; font: 15px system-ui, -apple-system, sans-serif; color: var(--text); outline: none; }
.pal .res { max-height: 340px; overflow: auto; padding: 6px; }
.pal .grp { padding: 10px 10px 4px; font-size: 11px; font-weight: 600; color: var(--faint); }
.pal .it { display: flex; gap: 10px; align-items: center; height: 36px; padding: 0 10px; border-radius: 8px; cursor: pointer; }
.pal .it[aria-selected="true"] { background: var(--hover); }
.pal .it .h { margin-left: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 11px var(--mono); color: var(--faint); }
.pal .none { padding: 14px 10px; color: var(--faint); }
.pal .end { display: flex; gap: 16px; align-items: center; padding: 0 14px; height: 36px; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px; }
.pal .end span { display: inline-flex; gap: 6px; align-items: center; }
.pal .end .grow { flex: 1; }
@media (prefers-reduced-motion: reduce) { .panel, .ws .ind, .scrim, .pal { transition: none; animation: none; } }
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
.icon { flex: none; }
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
.body { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; min-height: 0; }
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
.card { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.card .label { color: var(--dim); font-size: 11px; }
.card .value { font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.card .note { color: var(--faint); font-size: 11px; }
.rows { width: 100%; border-collapse: collapse; }
.rows th { text-align: left; color: var(--faint); font-weight: 500; font-size: 11px; }
.rows td, .rows th { padding: 4px 10px 4px 0; border-bottom: 1px solid var(--line); vertical-align: middle; }
.rows tr:hover td { background: #ffffff05; }
tr.large td { color: var(--yellow); }
.pill { display: inline-block; padding: 0 7px; border-radius: 999px; font: 11px/18px var(--mono); background: var(--raised); color: var(--dim); white-space: nowrap; }
.pill.blue { background: #7cb7ff1f; color: var(--blue); } .pill.purple { background: #c49bff1f; color: var(--purple); }
.pill.green { background: #7fd99a1f; color: var(--green); } .pill.yellow { background: #ffd1661f; color: var(--yellow); }
.pill.red { background: #ff7a7a1f; color: var(--red); } .pill.accent { background: #ee7a3e22; color: #ffb48a; }
.pill .name { color: #ffc28f; }
.link { color: var(--blue); padding: 0; border: 0; font-family: var(--mono); text-align: left; }
.link:hover { background: none; text-decoration: underline; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; color: var(--dim); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
.inspect-card { position: fixed; z-index: 2147483647; display: flex; flex-direction: column; gap: 5px; max-width: 340px; padding: 9px 11px; border: 1px solid var(--line, #2f2c31); border-radius: 10px; background: #19181aee; color: #ece8e4; font: 12px/1.4 system-ui, -apple-system, sans-serif; box-shadow: 0 10px 28px #0008; pointer-events: none; backdrop-filter: blur(6px); }
.inspect-card .card-head { display: flex; justify-content: space-between; gap: 12px; color: #ffb48a; }
.inspect-card .card-component { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.inspect-card .card-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.inspect-card .card-hint { margin-top: 2px; padding-top: 6px; border-top: 1px solid #2f2c31; color: #6f6862; font-size: 11px; }
.outline { position: fixed; pointer-events: none; border: 2px solid #ee7a3e; background: #ee7a3e22; border-radius: 3px; z-index: 2147483646; }
`;
