import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateVersions,buildMetadata,metadataFromTag,writeChecksums} from '../scripts/release.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source={
  metadata:JSON.parse(await read('package.json')),
  lock:JSON.parse(await read('package-lock.json')),
  tauri:JSON.parse(await read('src-tauri/tauri.conf.json')),
  cargo:await read('src-tauri/Cargo.toml'),
  cargoLock:await read('src-tauri/Cargo.lock'),
};
const version=source.metadata.version;
assert.equal(validateVersions(source),version);
assert.equal(validateVersions(source,`v${version}`),version);
assert.equal(validateVersions({...source,cargo:source.cargo.replace(/\r?\n/g,'\r\n'),cargoLock:source.cargoLock.replace(/\r?\n/g,'\r\n')},`v${version}`),version);
for(const tag of [version,'v9.9.9',`v${version}.20261110`])assert.throws(()=>validateVersions(source,tag),/Release trigger tag/);
const metadata=buildMetadata(version,new Date('2026-11-10T15:30:00.123+08:00'));
assert.deepEqual(metadata,{version,timestamp:'20261110T073000Z',tag:'build-20261110T073000Z',title:`CAFD Reader ${version} · 20261110T073000Z`});
assert.deepEqual(metadataFromTag(version,metadata.tag),metadata);
assert.notEqual(buildMetadata(version,new Date('2026-11-10T07:30:01Z')).tag,metadata.tag);
for(const tag of ['v0.1.0','build-20261110T073000','build-20261110T073000+0800','build-20260230T073000Z','build-20261310T073000Z','build-20261110T253000Z'])assert.throws(()=>metadataFromTag(version,tag));
for(const key of ['lock','tauri','cargo','cargoLock']){
  const changed=structuredClone(source);
  if(key==='lock')changed.lock.packages[''].version='9.9.9';
  else if(key==='tauri')changed.tauri.version='9.9.9';
  else changed[key]=changed[key].replace(`version = "${version}"`,'version = "9.9.9"');
  assert.throws(()=>validateVersions(changed),/do not match/);
}
const directory=await mkdtemp(join(tmpdir(),'cafd-release-'));
try{
  await assert.rejects(writeChecksums(directory,metadata),/exactly three packages/);
  const names=['windows-x64-setup.exe','ubuntu-x64.deb','android-arm64-unsigned.apk'].map(suffix=>`cafd-reader-${version}-${metadata.timestamp}-${suffix}`).sort();
  for(const name of names)await writeFile(join(directory,name),'abc');
  await writeFile(join(directory,'unexpected.txt'),'abc');
  await assert.rejects(writeChecksums(directory,metadata),/exactly three packages/);
  await rm(join(directory,'unexpected.txt'));
  await writeFile(join(directory,names[0]),'');
  await assert.rejects(writeChecksums(directory,metadata),/Empty package/);
  await rm(join(directory,names[0]));
  await mkdir(join(directory,names[0]));
  await assert.rejects(writeChecksums(directory,metadata));
  await rm(join(directory,names[0]),{recursive:true});
  await writeFile(join(directory,names[0]),'abc');
  await assert.rejects(writeChecksums(directory,buildMetadata(version,new Date('2026-11-10T07:30:01Z'))),/exactly three packages/);
  await writeChecksums(directory,metadata);
  const digest='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.equal(await readFile(join(directory,'SHA256SUMS'),'utf8'),names.map(name=>`${digest}  ${name}\n`).join(''));
}finally{await rm(directory,{recursive:true,force:true});}
console.log('PASS Program version consistency, shared UTC build IDs, invalid dates, mixed-build rejection and SHA-256 manifests');
