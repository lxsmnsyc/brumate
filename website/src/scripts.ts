// Small inline scripts that run before brumate. They are plain scripts, so
// they load nothing and do not count against what brumate ships.

/** Applies the saved theme before the page paints, so it does not flash. */
export const THEME_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})()</script>`;

/**
 * Records the scripts that the page loads, for the network panels of the
 * demos. An element with `data-network` shows them. Its `data-only` lists name
 * prefixes, split by spaces, and with none the element shows every script. A
 * panel counts the scripts loaded since its page began: since the load, or since
 * the client navigation that added the panel started. The router marks the start
 * with `data-navigating` on the root element, for every kind of navigation. A
 * navigation that loads nothing new shows a note and 0 KB.
 */
export const NETWORK_SCRIPT = `<script>(function(){var list=[];var navAt=0;var watching=false;function short(n){var u=new URL(n,location.href);var f=u.pathname.split('/').pop()||u.pathname;var m=window.__scriptNames||{};return m[f]||f}function add(e){if(e.initiatorType!=='script'&&e.initiatorType!=='other'&&e.initiatorType!=='link')return;if(!/\\.(m?js|ts)(\\?|$)|brumate/.test(e.name))return;list.push({name:short(e.name),size:e.transferSize||e.encodedBodySize||0,at:e.startTime});render()}function render(){document.querySelectorAll('[data-network]').forEach(function(el){if(!el.hasAttribute('data-since'))el.setAttribute('data-since',String(navAt));var since=Number(el.getAttribute('data-since'));var total=0;var only=(el.getAttribute('data-only')||'').split(' ').filter(Boolean);var rows=list.filter(function(r){return r.at>=since&&(!only.length||only.some(function(p){return r.name.indexOf(p)===0}))}).map(function(r){total+=r.size;return '<li><span class="file">'+r.name+'</span><span class="size">'+(r.size?(r.size/1024).toFixed(1)+' KB':'cached')+'</span></li>'}).join('');el.querySelector('ol').innerHTML=rows||'<li class="empty">'+(since?'Nothing new: the page used scripts already loaded':'Nothing yet')+'</li>';el.querySelector('[data-total]').textContent=total?(total/1024).toFixed(1)+' KB':'0 KB'})}function added(records){for(var i=0;i<records.length;i++){for(var j=0;j<records[i].addedNodes.length;j++){var n=records[i].addedNodes[j];if(n.nodeType===1&&(n.hasAttribute('data-network')||n.querySelector('[data-network]')))return render()}}}function navigating(){if(!document.documentElement.hasAttribute('data-navigating'))return;navAt=performance.now();if(watching)return;watching=true;new MutationObserver(added).observe(document.body,{childList:true,subtree:true})}try{new PerformanceObserver(function(l){l.getEntries().forEach(add)}).observe({type:'resource',buffered:true})}catch(e){}window.__network={render:render};document.addEventListener('DOMContentLoaded',render);new MutationObserver(navigating).observe(document.documentElement,{attributes:true,attributeFilter:['data-navigating']})})()</script>`;
