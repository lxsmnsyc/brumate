import re,subprocess,collections
files=subprocess.check_output("git ls-files 'packages/ui/src/*.brm' | grep -v /test/",shell=True,text=True).split()
rd=0;fields=0;byctx=collections.defaultdict(lambda:[0,0]);big=[]
for f in files:
    s=open(f).read()
    for m in re.finditer(r'(?:const|let)\s+(\{[^}]*\}|\w+)\s*=\s*\$getContext\((\w+)\)',s):
        v,c=m.groups();rd+=1
        if v.startswith('{'):
            n=len([p for p in v.strip('{}').split(',') if p.strip()])
        else:
            n=len(set(re.findall(r'\b'+v+r'\??\.(\w+)',s)))
        fields+=n;byctx[c][0]+=1;byctx[c][1]+=n
        if n>=5: big.append((f.split('/')[-1],c,n))
print('readers',rd,'field reads',fields,'avg',round(fields/rd,2))
print('contexts',len(byctx))
print('readers with >=5 fields',len(big),big[:12])
