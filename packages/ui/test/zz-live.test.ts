import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'brumate';
import { it } from 'vitest';
it('lists', () => {
  const out: string[] = [];
  const dir = join(import.meta.dirname, '../src');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.brm')) continue;
    const path = join(dir, f);
    const { parts, client } = compile(readFileSync(path, 'utf8'), { filename: f, path });
    const text = [client, ...Object.values(parts)].join('\n');
    let at = text.indexOf('updateContext($$s, ');
    while (at !== -1) {
      const end = text.indexOf('\n}', at);
      const body = text.slice(at, end);
      const ctx = /updateContext\(\$\$s, (\w+)/.exec(body)![1];
      const open = body.indexOf('{'); const keys: string[] = []; let depth=0, from=open+1;
      for (let i=open;i<body.length;i++){const c=body[i]; if('{(['.includes(c)) depth++; else if('})]'.includes(c)) depth--; if((c===','&&depth===1)||depth===0){const e=body.slice(from,i).trim(); const k=e.indexOf(':'); if(e&&k!==-1){const v=e.slice(k+1); if(!v.includes('=>')&&!v.includes('.bind(')&&v.includes('$$b.get(')) keys.push(e.slice(0,k).trim());} from=i+1; if(depth===0)break;}}
      const reads = keys.length ? keys.join('|') : (open===-1 && body.includes('$$b.get(') ? 'WHOLE' : 0);
      out.push(`${f} ${ctx} reads=${reads}`);
      at = text.indexOf('updateContext($$s, ', end);
    }
  }
  writeFileSync(process.env.OUT!, out.join('\n'));
});
