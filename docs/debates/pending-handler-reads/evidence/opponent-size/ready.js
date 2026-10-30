function Rd(s,i){let v=s.s[i];return v instanceof Promise?v.then(()=>Rd(s,i)):get(s,i)}
