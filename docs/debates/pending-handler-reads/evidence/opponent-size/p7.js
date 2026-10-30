function Wt(s){let p=[];for(;s;s=s.p)for(let v of s.s)v instanceof Promise&&p.push(v.then(Wa,Wa));return Promise.all(p)}function Wa(){return new Promise(r=>setTimeout(r))}
