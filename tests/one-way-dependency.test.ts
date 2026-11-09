// @vitest-environment node
import {it,expect} from 'vitest';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
// TECRID never calls VLE. Links to VLE pages are fine; server calls to its API are not.
function files(dir:string):string[]{return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):/\.(ts|tsx|js|mjs)$/.test(name)?[path]:[];});}
it('has no server calls to VLE and no relay configuration',()=>{
 const offenders=['app','lib','worker'].flatMap(files).filter(path=>{const text=readFileSync(path,'utf8');return /vle\.exchange\/api\//.test(text)||/TECRID_EMAIL_RELAY_|integrations\/vle/.test(text);});
 expect(offenders).toEqual([]);
});
