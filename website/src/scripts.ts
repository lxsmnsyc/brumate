// Small inline scripts that run before brumate. They are plain scripts, so
// they load nothing and do not count against what brumate ships.

/** Applies the saved theme before the page paints, so it does not flash. */
export const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})()</script>`;

/**
 * Records the scripts that the page loads, for the network panels of the
 * demos. An element with `data-network` shows them. Its `data-only` lists name
 * prefixes, split by spaces, and with none the element shows every script.
 */
export const NETWORK_SCRIPT = `<script>(function(){var list=[];var start=performance.now();function short(n){var u=new URL(n,location.href);var f=u.pathname.split('/').pop()||u.pathname;var m=window.__scriptNames||{};return m[f]||f}function add(e){if(e.initiatorType!=='script'&&e.initiatorType!=='other'&&e.initiatorType!=='link')return;if(!/\\.(m?js|ts)(\\?|$)|brumate/.test(e.name))return;list.push({name:short(e.name),size:e.transferSize||e.encodedBodySize||0,at:Math.round(e.startTime)});render()}function render(){document.querySelectorAll('[data-network]').forEach(function(el){var total=0;var only=(el.getAttribute('data-only')||'').split(' ').filter(Boolean);var rows=list.filter(function(r){return!only.length||only.some(function(p){return r.name.indexOf(p)===0})}).map(function(r){total+=r.size;return '<li><span class="file">'+r.name+'</span><span class="size">'+(r.size?(r.size/1024).toFixed(1)+' KB':'cached')+'</span></li>'}).join('');el.querySelector('ol').innerHTML=rows||'<li class="empty">Nothing yet</li>';el.querySelector('[data-total]').textContent=(total/1024).toFixed(1)+' KB'})}try{new PerformanceObserver(function(l){l.getEntries().forEach(add)}).observe({type:'resource',buffered:true})}catch(e){}window.__network={render:render};document.addEventListener('DOMContentLoaded',render)})()</script>`;
