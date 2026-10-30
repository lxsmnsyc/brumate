let Ln=new WeakMap;function Lk(e,w,run){let k=e.closest("form")??e,b=Ln.get(k)??Promise.resolve(),n=b.then(()=>w).then(run);Ln.set(k,n.catch(()=>{}));return n}
