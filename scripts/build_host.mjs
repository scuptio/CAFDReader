import {createHash} from 'node:crypto';
// 使用明确资源清单构建宿主，暂存成功后替换旧输出，拒绝混入电子书。
import {cp,mkdir,writeFile,rename,rm,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('dist-host/',root),stage=new URL(`build/host-stage-${process.pid}/`,root),backup=new URL(`build/host-previous-${process.pid}/`,root);
await mkdir(stage,{recursive:true});
const files=['index.html','shelf.js','platform.js','platform/browser.js','platform/native.js','reader/index.html','reader/reader.css','reader/reader.js','reader/app-protocol.js','reader/caf.js','reader/caf.worker.js'];
try{
 for(const file of files){const destination=new URL(file,stage);await mkdir(new URL('./',destination),{recursive:true});await cp(new URL('web/'+file,root),destination);}
 await mkdir(new URL('books/',stage),{recursive:true});await writeFile(new URL('books/catalog.json',stage),'[]\n');
 await build({stdin:{contents:"export {invoke,convertFileSrc} from '@tauri-apps/api/core';",resolveDir:fileURLToPath(root)},bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('native-api.js',stage))});
 const metadata=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
 const specification=JSON.parse(await readFile(new URL('spec/version.json',root),'utf8'));
 const entries={};
 for(const file of [...files,'books/catalog.json','native-api.js'].sort())entries[file]=createHash('sha256').update(await readFile(new URL(file,stage))).digest('hex');
 await writeFile(new URL('release.json',stage),JSON.stringify({schema_version:1,product:'cafd-reader',version:metadata.version,spec_version:specification.version,files:entries},null,2)+'\n');
 let previous=false;try{await rename(out,backup);previous=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 try{await rename(stage,out);}catch(error){if(previous)await rename(backup,out);throw error;}
 if(previous)await rm(backup,{recursive:true});
 console.log('通用宿主已生成：dist-host（明确资源清单，不含电子书）');
}finally{await rm(stage,{recursive:true,force:true});}
