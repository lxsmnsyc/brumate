let Ld=document.readyState=="complete"?Promise.resolve():new Promise(r=>addEventListener("load",r));function Cp(p,s){return Promise.race([p,s?Ld:new Promise(r=>setTimeout(r,5e3))])}
