import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

test('published files contain no API keys, private credentials, or key-based Picker dependency',async()=>{
  const root=new URL('../dist/',import.meta.url);
  const entries=await readdir(root,{recursive:true,withFileTypes:true});
  const forbidden=[/AIza[\w-]{35}/,/GOCSPX-[\w-]+/,/ya29\.[\w.-]+/,/gh[pousr]_[\w]{20,}/,/github_pat_[\w]+/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/GOOGLE_PICKER_API_KEY|setDeveloperKey|apis\.google\.com\/js\/api\.js/];
  for(const entry of entries){
    if(!entry.isFile())continue;
    const text=await readFile(`${entry.parentPath}/${entry.name}`,'utf8');
    for(const pattern of forbidden)assert.equal(pattern.test(text),false,`Credential or key-based dependency found in ${entry.name}; value withheld`);
  }
});
