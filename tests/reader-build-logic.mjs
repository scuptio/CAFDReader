// 验证平台选择、命令边界与失败传播；不要求安装外平台 SDK。
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseOptions,buildPlan,repairAndroidProject} from '../scripts/reader.mjs';
const on=(system,arch='x64',generated=()=>false)=>({system,arch,generated});
for(const [system,name] of [['linux','linux'],['win32','windows'],['darwin','macos']]){
 const options=parseOptions([],system);assert.equal(options.platform,name);
 assert.deepEqual(buildPlan(options,on(system)),[{kind:'tauri',args:['build','--no-sign','--','--locked']}]);
}
assert.throws(()=>parseOptions(['windwos'],'linux'),/不支持的平台/);
assert.throws(()=>buildPlan(parseOptions(['windows'],'linux'),on('linux')),/须在 windows/);
assert.throws(()=>buildPlan(parseOptions(['ios'],'linux'),on('linux')),/macOS/);
for(const platform of ['windows','macos','ios'])assert.ok(buildPlan(parseOptions([platform,'--plan'],'linux'),on('linux')).length);
assert.deepEqual(buildPlan(parseOptions(['web'],'linux'),on('linux')),[{kind:'host',args:[]}]);
assert.throws(()=>buildPlan(parseOptions(['web','--dev'],'linux'),on('linux')),/静态 HTTP/);
assert.deepEqual(buildPlan(parseOptions(['linux','--','--config','path with space.json'],'linux'),on('linux'))[0].args,['build','--no-sign','--config','path with space.json','--','--locked']);
assert.deepEqual(buildPlan(parseOptions(['--dev','linux'],'linux'),on('linux'))[0].args,['dev','--','--locked']);
const android=buildPlan(parseOptions(['android'],'linux'),on('linux'));
assert.equal(android.length,2);assert.deepEqual(android[0].args.slice(0,3),['android','init','--ci']);
assert.deepEqual(android[1].args,['android','build','--debug','--apk','--target','aarch64']);
const existing=buildPlan(parseOptions(['android','--','--target','x86_64'],'linux'),on('linux','x64',()=>true));
assert.equal(existing.length,1);assert.equal(existing[0].args.filter(a=>a==='--target').length,1);assert.equal(existing[0].args.at(-1),'x86_64');
for(const [arch,target] of [['arm64','aarch64-sim'],['x64','x86_64']])assert.ok(buildPlan(parseOptions(['ios'],'darwin'),on('darwin',arch)).at(-1).args.includes(target));
const invalid=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/reader.mjs',import.meta.url)),'typo'],{encoding:'utf8'});
assert.equal(invalid.status,1);assert.match(invalid.stderr,/不支持的平台/);
const temporary=mkdtempSync(join(tmpdir(),'cafd-android-repair-'));
try{
 const kotlin=join(temporary,'src-tauri/gen/android/buildSrc/src/main/java/org/caf/reader/kotlin');mkdirSync(kotlin,{recursive:true});
 const task=join(kotlin,'BuildTask.kt');writeFileSync(task,'val args = listOf("tauri", "android", "android-studio-script");\n');
 const properties=join(temporary,'src-tauri/gen/android/gradle.properties');writeFileSync(properties,'kotlin.code.style=official\n');
 assert.equal(repairAndroidProject(temporary),task);
 assert.match(readFileSync(task,'utf8'),/node_modules\/@tauri-apps\/cli\/tauri\.js/);
 assert.match(readFileSync(properties,'utf8'),/^kotlin\.incremental=false$/m);
 repairAndroidProject(temporary);assert.equal(readFileSync(properties,'utf8').match(/kotlin\.incremental=false/g).length,1);
}finally{rmSync(temporary,{recursive:true,force:true});}
console.log('PASS 阅读器平台选择、跨平台限制、移动端初始化、参数边界与失败退出');
