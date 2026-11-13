// 发布前校验版本与完整产物集合，不修改程序版本或规范版本。
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export function validateVersions({metadata,lock,tauri,cargo,cargoLock},sourceTag=''){
  const version=metadata.version;
  const rustVersion=cargo.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1];
  const lockedVersion=cargoLock.match(/\[\[package\]\]\s+name\s*=\s*"cafd-reader"\s+version\s*=\s*"([^"]+)"/)?.[1];
  if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw Error('Program version must use SemVer, e.g. 0.1.0.');
  if(sourceTag&&sourceTag!==`v${version}`)throw Error('Release trigger tag must be v + program version, e.g. v0.1.0.');
  if([lock.version,lock.packages?.['']?.version,tauri.version,rustVersion,lockedVersion].some(value=>value!==version))throw Error('Program versions in package / npm lock / Tauri / Cargo / Cargo lock do not match.');
  return version;
}
export function buildMetadata(version,date=new Date()){
  const timestamp=date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  if(!/^\d{8}T\d{6}Z$/.test(timestamp))throw Error('Build time must be a valid UTC timestamp with a four-digit year.');
  return {version,timestamp,tag:`build-${timestamp}`,title:`CAFD Reader ${version} · ${timestamp}`};
}
export function metadataFromTag(version,tag){
  const match=/^build-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(tag);
  if(!match)throw Error('Build tag must use build-YYYYMMDDTHHmmssZ.');
  const [,year,month,day,hour,minute,second]=match;
  const result=buildMetadata(version,new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`));
  if(result.tag!==tag)throw Error('Build tag contains an invalid UTC date.');
  return result;
}
async function versionFor(sourceTag=''){
  const paths=['package.json','package-lock.json','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock'];
  const [metadata,lock,tauri,cargo,cargoLock]=await Promise.all(paths.map(path=>readFile(resolve(root,path),'utf8')));
  return validateVersions({metadata:JSON.parse(metadata),lock:JSON.parse(lock),tauri:JSON.parse(tauri),cargo,cargoLock},sourceTag);
}
export async function writeChecksums(directory,{version,timestamp}){
  const expected=['windows-x64-setup.exe','ubuntu-x64.deb','android-arm64-unsigned.apk','macos-universal.dmg'].map(suffix=>`cafd-reader-${version}-${timestamp}-${suffix}`);
  expected.push(`cafd-reader-web-${version}-${timestamp}.tar.gz`);
  expected.sort();
  const actual=(await readdir(directory)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Release assets must contain exactly five packages: Windows x64, Ubuntu x64, Android ARM64, macOS universal and the web host tarball.');
  const lines=[];
  for(const name of expected){
    const bytes=await readFile(resolve(directory,name));
    if(!bytes.length)throw Error(`Empty package: ${name}`);
    lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  }
  await writeFile(resolve(directory,'SHA256SUMS'),lines.join('\n')+'\n');
}
async function main(){
  const [command,tag='',directory,...extra]=process.argv.slice(2);
  if(extra.length||!['metadata','checksums'].includes(command)||(command==='checksums'?!directory:directory))throw Error('Usage: node scripts/release.mjs metadata [release-trigger-tag] | checksums <build-tag> <directory>');
  const version=await versionFor(command==='metadata'?tag:'');
  if(command==='metadata'){
    for(const [key,value] of Object.entries(buildMetadata(version)))console.log(`${key}=${value}`);
  }else await writeChecksums(resolve(directory),metadataFromTag(version,tag));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
