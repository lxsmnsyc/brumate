function Cp(p){return Promise.race([p,new Promise(r=>setTimeout(r,5e3))])}
