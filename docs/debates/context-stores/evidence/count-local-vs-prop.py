import re,subprocess
files=subprocess.check_output("git ls-files '*.brm' | grep -v /test/",shell=True,text=True).split()
loc=propo=none=0
for f in files:
    s=open(f).read()
    if '$setContext(' not in s: continue
    props=set()
    for m in re.finditer(r'const\s+\{([^}]*)\}\s*=\s*\$props',s):
        for p in m.group(1).split(','):
            p=p.strip().lstrip('.')
            if p: props.add(re.split(r'[=:\s]',p)[0])
    local=set()
    for m in re.finditer(r'(?:let|const)\s+(\w+)\s*=\s*\$(?:signal|memo)\b',s): local.add(m.group(1))
    for m in re.finditer(r'\blet\s+(\w+)\b',s): local.add(m.group(1))
    for m in re.finditer(r'\$setContext\(',s):
        i=m.end();d=1
        while d and i<len(s):
            d+=(s[i]=='(')-(s[i]==')');i+=1
        a=s[m.end():i-1]
        a=a.split(',',1)[1] if ',' in a else ''
        # drop arrow function bodies roughly: remove "=> {...}" not handled; count anyway
        hl=any(re.search(r'\b'+re.escape(n)+r'\b',a) for n in local)
        hp=any(re.search(r'\b'+re.escape(n)+r'\b',a) for n in props-local)
        if hl: loc+=1
        elif hp: propo+=1
        else: none+=1
print('local signal/memo/let',loc,'props only',propo,'neither',none)
