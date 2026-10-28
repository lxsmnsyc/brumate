// Small inline scripts that run before brumate. They are plain scripts, so
// they load nothing and do not count against what brumate ships.

/** Applies the saved theme before the page paints, so it does not flash. */
export const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})()</script>`;

/**
 * Records the scripts that the page loads, for the network panels of the
 * demos. A `<brumate-network>` element shows them.
 */
export const NETWORK_SCRIPT = `<script>(function(){var list=[];var start=performance.now();function short(n){var u=new URL(n,location.href);var f=u.pathname.split('/').pop()||u.pathname;var m=window.__scriptNames||{};return m[f]||f}function add(e){if(e.initiatorType!=='script'&&e.initiatorType!=='other'&&e.initiatorType!=='link')return;if(!/\\.(m?js|ts)(\\?|$)|brumate/.test(e.name))return;list.push({name:short(e.name),size:e.transferSize||e.encodedBodySize||0,at:Math.round(e.startTime)});render()}function render(){document.querySelectorAll('[data-network]').forEach(function(el){var total=0;var rows=list.map(function(r){total+=r.size;return '<li><span class="file">'+r.name+'</span><span class="size">'+(r.size?(r.size/1024).toFixed(1)+' KB':'cached')+'</span></li>'}).join('');el.querySelector('ol').innerHTML=rows||'<li class="empty">Nothing yet</li>';el.querySelector('[data-total]').textContent=(total/1024).toFixed(1)+' KB'})}try{new PerformanceObserver(function(l){l.getEntries().forEach(add)}).observe({type:'resource',buffered:true})}catch(e){}window.__network={render:render};document.addEventListener('DOMContentLoaded',render)})()</script>`;

/**
 * Scales the preview of each card of @brumate/ui to fit its box, never up. The card wraps the demo
 * in a `.ui-fit` element at its natural size, and this sets `--fit` on it. It runs on load, when a
 * box or a demo changes size, and when a client navigation adds cards.
 */
export const FIT_SCRIPT = `<script>(function(){var ro=window.ResizeObserver&&new ResizeObserver(function(l){l.forEach(function(e){fit(e.target.closest?e.target.closest('.ui-demo-stage'):e.target)})});function fit(s){var i=s&&s.firstElementChild;if(!i)return;var c=getComputedStyle(s);var w=s.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight);var h=s.clientHeight-parseFloat(c.paddingTop)-parseFloat(c.paddingBottom);if(!i.offsetWidth||!i.offsetHeight)return;var f=Math.min(1,w/i.offsetWidth,h/i.offsetHeight);i.style.setProperty('--fit',String(Math.floor(f*1000)/1000))}function scan(){document.querySelectorAll('.ui-card .ui-demo-stage:not([data-fit])').forEach(function(s){s.setAttribute('data-fit','');fit(s);if(ro){ro.observe(s);ro.observe(s.firstElementChild)}})}scan();document.addEventListener('DOMContentLoaded',scan);window.addEventListener('load',scan);new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true})})()</script>`;
