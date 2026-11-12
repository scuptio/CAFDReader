import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('./fixtures/',import.meta.url),manifest=JSON.parse(await readFile(new URL('sha256.json',base)));
for(const [file,expected] of Object.entries(manifest))assert.equal(createHash('sha256').update(await readFile(new URL(file,base))).digest('hex'),expected,file);
console.log('PASS Independent fixture and rebuild source hashes match');
