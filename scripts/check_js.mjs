// 静态检查模块作用域，避免拆分时意外依赖未声明的共享变量。
import {readFile,readdir} from 'node:fs/promises';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';
import {fileURLToPath} from 'node:url';
const standard=new Set('undefined NaN Infinity globalThis Object Array String Number Boolean BigInt Symbol Math JSON RegExp Date Intl Reflect Proxy Promise Map Set WeakMap WeakSet Error TypeError RangeError SyntaxError ReferenceError AggregateError EvalError URIError ArrayBuffer SharedArrayBuffer DataView Atomics Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array parseInt parseFloat isFinite isNaN encodeURI decodeURI encodeURIComponent decodeURIComponent getComputedStyle URLSearchParams DOMParser Option WebAssembly DecompressionStream Response Request Headers AbortController parent top window document navigator location localStorage crypto URL Blob File FileReader TextEncoder TextDecoder FontFace Node NodeFilter HTMLElement ResizeObserver MutationObserver MessageChannel Worker WorkerGlobalScope FileReaderSync XMLHttpRequest performance console fetch atob btoa setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame self addEventListener postMessage'.split(' '));
async function files(directory){const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())result.push(...await files(path));else if(entry.name.endsWith('.js'))result.push(path);}return result;}
let count=0;const errors=[];
for(const dir of ['../web/'])for(const url of await files(new URL(dir,import.meta.url))){
 const source=await readFile(url,'utf8'),ast=parse(source,{ecmaVersion:2022,sourceType:'module',ranges:true});
 const scope=analyze(ast,{ecmaVersion:2022,sourceType:'module'});
 for(const factory of scope.scopes.filter(s=>s.block.type==='FunctionDeclaration'&&s.block.id?.name.startsWith('install'))){
  const parameter=factory.block.params[0]?.name;if(!parameter)continue;
  for(const nested of scope.scopes){let owner=nested.upper;while(owner&&owner!==factory)owner=owner.upper;if(owner===factory&&nested.variables.some(v=>v.name===parameter))errors.push(fileURLToPath(url)+' 注入依赖名被局部变量遮蔽：'+parameter);}
 }
 const missing=[...new Set(scope.globalScope.through.map(r=>r.identifier.name))].filter(n=>!standard.has(n));
 if(missing.length)errors.push(fileURLToPath(url)+' 存在未声明依赖：'+missing.join(', '));count++;
}
if(errors.length)throw Error(errors.join('\n'));
console.log(`PASS ${count} 个 JavaScript 模块的语法与作用域依赖`);
