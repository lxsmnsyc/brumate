import re,subprocess,sys
files=subprocess.run(['git','ls-files','*.brm'],capture_output=True,text=True).stdout.split()
bodies=single=0
pat=re.compile(r'#(?:if|else|for|key|try|catch|loading|client|defer|offscreen|portal|head|switch|case|default)\b[^{\n]*\{')
for f in files:
    if '/test/' in f or f.startswith('e2e/'): continue
    s=open(f).read()
    for m in pat.finditer(s):
        i=m.end(); depth=1; j=i
        while j<len(s) and depth:
            if s[j]=='{': depth+=1
            elif s[j]=='}': depth-=1
            j+=1
        body=s[i:j-1].strip()
        bodies+=1
        if body.startswith('<') and body.endswith('>') and body.count('\n')<=1 and not body.startswith('<script'):
            # one element on one line, roughly
            single+=1
print('non-test .brm files',len([f for f in files if '/test/' not in f and not f.startswith('e2e/')]))
print('block bodies',bodies,'one-line single-element bodies',single)
