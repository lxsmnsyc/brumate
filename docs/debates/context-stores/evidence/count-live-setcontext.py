import re,subprocess,sys
files=subprocess.check_output("git ls-files '*.brm' | grep -v /test/",shell=True,text=True).split()
tot=live=0;fn=0;out=[]
for f in files:
    s=open(f).read()
    if '$setContext(' not in s: continue
    names=set()
    for m in re.finditer(r'const\s+\{([^}]*)\}\s*=\s*\$props',s):
        for p in m.group(1).split(','):
            p=p.strip().lstrip('.')
            if p: names.add(re.split(r'[=:\s]',p.split(':')[-1].strip())[0] if ':' in p else re.split(r'[=\s]',p)[0])
    for m in re.finditer(r'(?:let|const)\s+(\w+)\s*=\s*\$(?:signal|memo|derived|props)\b',s): names.add(m.group(1))
    for m in re.finditer(r'let\s+(\w+)\b',s): names.add(m.group(1))
    for m in re.finditer(r'\$setContext\(',s):
        i=m.end();d=1
        while d and i<len(s):
            d+= (s[i]=='(')-(s[i]==')');i+=1
        a=s[m.end():i-1]
        a=a.split(',',1)[1] if ',' in a else ''
        tot+=1
        if any(re.search(r'\b'+re.escape(n)+r'\b',a) for n in names if n): live+=1
        if '=>' in a or 'function' in a: fn+=1
print(tot,live,fn)
