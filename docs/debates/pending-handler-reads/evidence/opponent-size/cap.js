let Ld=new Promise(r=>addEventListener("load",r));function Cp(p){return Promise.race([p,Ld,new Promise(r=>setTimeout(r,3e3))])}
