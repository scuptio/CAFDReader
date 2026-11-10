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
  if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw Error('程序版本须使用 SemVer，例如 0.1.0。');
  if(sourceTag&&sourceTag!==`v${version}`)throw Error('正式版本触发标签须为 v + 程序版本，例如 v0.1.0。');
  if([lock.version,lock.packages?.['']?.version,tauri.version,rustVersion,lockedVersion].some(value=>value!==version))throw Error('package / npm lock / Tauri / Cargo / Cargo lock 程序版本不一致。');
  return version;
}
export function buildMetadata(version,date=new Date()){
  const timestamp=date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  if(!/^\d{8}T\d{6}Z$/.test(timestamp))throw Error('构建时间须为有效的四位年份 UTC 时间。');
  return {version,timestamp,tag:`build-${timestamp}`,title:`CAFD Reader ${version} · ${timestamp}`};
}
export function metadataFromTag(version,tag){
  const match=/^build-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(tag);
  if(!match)throw Error('构建标签须为 build-YYYYMMDDTHHmmssZ。');
  const [,year,month,day,hour,minute,second]=match;
  const result=buildMetadata(version,new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`));
  if(result.tag!==tag)throw Error('构建标签包含无效的 UTC 日期。');
  return result;
}
async function versionFor(sourceTag=''){
  const paths=['package.json','package-lock.json','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock'];
  const [metadata,lock,tauri,cargo,cargoLock]=await Promise.all(paths.map(path=>readFile(resolve(root,path),'utf8')));
  return validateVersions({metadata:JSON.parse(metadata),lock:JSON.parse(lock),tauri:JSON.parse(tauri),cargo,cargoLock},sourceTag);
}
export async function writeChecksums(directory,{version,timestamp}){
  const expected=['windows-x64-setup.exe','ubuntu-x64.deb','android-arm64.apk'].map(suffix=>`cafd-reader-${version}-${timestamp}-${suffix}`).sort();
  const actual=(await readdir(directory)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('发布产物必须恰好包含 Windows x64、Ubuntu x64 和 Android ARM64 三个安装包。');
  const lines=[];
  for(const name of expected){
    const bytes=await readFile(resolve(directory,name));
    if(!bytes.length)throw Error(`安装包为空：${name}`);
    lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  }
  await writeFile(resolve(directory,'SHA256SUMS'),lines.join('\n')+'\n');
}
async function main(){
  const [command,tag='',directory,...extra]=process.argv.slice(2);
  if(extra.length||!['metadata','checksums'].includes(command)||(command==='checksums'?!directory:directory))throw Error('用法：node scripts/release.mjs metadata [正式版本触发标签] | checksums <build标签> <目录>');
  const version=await versionFor(command==='metadata'?tag:'');
  if(command==='metadata'){
    for(const [key,value] of Object.entries(buildMetadata(version)))console.log(`${key}=${value}`);
  }else await writeChecksums(resolve(directory),metadataFromTag(version,tag));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
