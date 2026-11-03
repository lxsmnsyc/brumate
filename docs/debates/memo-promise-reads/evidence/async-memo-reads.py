# Estimates how many bare reads of async memos a Promise<T> type would break. Read-only.
# Async memo: `const|let X = $memo(` whose argument has `await`, `fetch(`, or a call to a name imported from a 'use server' file or a .server module.
import re,subprocess,sys
files=subprocess.run(['git','ls-files','*.brm'],capture_output=True,text=True).stdout.split()
decl=re.compile(r'(?:const|let)\s+(\w+)\s*=\s*(await\s+)?\$memo\(')
tot=asyncm=awaited=0; script_reads=markup_reads=derived=0; nfiles=0
for f in files:
    try: s=open(f).read()
    except: continue
    for m in decl.finditer(s):
        tot+=1
        # argument up to the matching line end (approximation: to the first ');' )
        end=s.find(');',m.end()); arg=s[m.end():end if end>0 else m.end()+200]
        names=re.findall(r'import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]',s)
        srv=set()
        for ns,src in names:
            import os
            t=os.path.normpath(os.path.join(os.path.dirname(f),src)) if src.startswith('.') else None
            cand=[t+e for e in ('','.ts','.js','/index.ts')] if t else []
            isserver=False
            for c in cand:
                if os.path.isfile(c):
                    isserver="'use server'" in open(c).read()[:300] or '"use server"' in open(c).read()[:300]; break
            if isserver:
                srv|={n.strip().split(' as ')[-1] for n in ns.split(',')}
        isasync = bool(re.search(r'\bawait\b|\bfetch\(',arg)) or any(re.search(r'\b'+re.escape(n)+r'\(',arg) for n in srv if n)
        if not isasync: continue
        asyncm+=1; awaited+= 1 if m.group(2) else 0
        name=m.group(1); nfiles+=1
        # split script and markup
        sm=re.search(r'</script>',s)
        i=s.rfind('</script>')
        script=s[:i]; markup=s[i:]
        body=script[m.end():]
        script_reads+=len(re.findall(r'(?<![\w.$])'+name+r'(?![\w$])',body))
        markup_reads+=len(re.findall(r'(?<![\w.$])'+name+r'(?![\w$])',markup))
print('memo declarations',tot,'async (heuristic)',asyncm,'of them awaited',awaited)
print('script-side mentions after declaration',script_reads,'markup mentions',markup_reads)
