core: /Users/alexis/Documents/GitHub/brumate/benchmarks/brumate/dist/client/assets/client-BFXg7Ztq-XuCj4PCw.js gzip -9     8749
== cap.js
let Ld=new Promise(r=>addEventListener("load",r));function Cp(p){return Promise.race([p,Ld,new Promise(r=>setTimeout(r,3e3))])}
== p1.js
function Wt(s,r){return Ve(s.m).then(m=>{let l=m.q?.[r.split("#")[1]],p=[];for(let i of l??[]){let v=s.s[i];v instanceof Promise&&p.push(v.then(Wa,Wa))}return Promise.all(p)})}function Wa(){return new Promise(r=>setTimeout(r))}
== p4.js
let Lv=new WeakSet;function Mk(s,i){s.q?.includes(i)&&Lv.add(s.s[i])}function Gc(v){if(!Cc&&!Ud&&Lv.has(v))throw new Nr(v)}
== p7.js
function Wt(s){let p=[];for(;s;s=s.p)for(let v of s.s)v instanceof Promise&&p.push(v.then(Wa,Wa));return Promise.all(p)}function Wa(){return new Promise(r=>setTimeout(r))}
== ready.js
function Rd(s,i){let v=s.s[i];return v instanceof Promise?v.then(()=>Rd(s,i)):get(s,i)}

Results (gzip -9 delta when appended to the core chunk, benchmarks/brumate dist on main):
p1.js (P1+P2 wait from per-module slot list) +66 B
p4.js (P4 memo-only marking + throw outside compute/update) +30 B
p7.js (P7 wait on scope chain) +40 B
cap.js (O3 cap: race with load event and 3 s timer) +24 B
ready.js (O8 handler await helper) +5 B
p1+p4 +123 B; p7+p4 +99 B; p1+p4+cap +162 B; p4+ready +61 B
Sketches only: no wiring into handle(), no compiler metadata, no effect skip. Appending overstates
nothing about wiring and understates per-module metadata bytes.

Round 2 (cumulative, with ../proponent-size sketches):
p1 p4 lane cap2 guessreset upd (P14) +292 B
own p4 lane cap2 guessreset upd +237 B
own p4 lane cap1 guessreset upd +207 B   (own.js: wait for marked loading promises in the scope; cap1.js: one 5 s timer)
