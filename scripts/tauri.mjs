// 兼容外部内容项目的原始 Tauri CLI 参数；不引入内容依赖。
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadAndroidEnvironment} from './android-env.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
try{
  if(process.argv[2]==='android')loadAndroidEnvironment(root);
 const p=require.resolve('@tauri-apps/cli/package.json'),metadata=require(p),cli=resolve(dirname(p),metadata.bin.tauri);
 const result=spawnSync(process.execPath,[cli,...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}catch(error){console.error('Unable to run Tauri; run npm ci in CAFDReader first: '+error.message);process.exitCode=1;}
