// 通用 caf:doc-web@1 契约；不含篇章、分页或排版逻辑。
export const APP_PROTOCOL='caf:doc-web@1';
export const DOCUMENT_CAPABILITY='caf:doc@1';
export async function documentManifest(runtime,info){
  if(!info||typeof info!=='object'||Array.isArray(info)||info.error)throw new Error(info?.error||'文档元信息无效');
  if(!info.web_app_manifest)return null;
  const files=runtime.artifact.files,path=resourcePath(info.web_app_manifest,files);
  if(files[path]>65536)throw new Error('文档应用清单过大');
  const bytes=await runtime.readPayload(path);
  if(bytes.byteLength>65536)throw new Error('文档应用清单过大');
  return appManifest(JSON.parse(new TextDecoder().decode(bytes)),files);
}
export const MAX_RESOURCE=32*1024*1024;
export function resourcePath(path,files) {
  if(typeof path!=='string' || path.length>1024 || !path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(p=>p==='.' || p==='..') || !Object.hasOwn(files,path)) throw new Error('Resource path denied');
  if(files[path]>MAX_RESOURCE) throw new Error('Resource exceeds read limit');
  return path;
}
export function appManifest(value,files) {
  if(value?.protocol!==APP_PROTOCOL || value.component!=='cafd' || !Array.isArray(value.methods) || !value.methods.length || value.methods.length>32 || value.methods.some(m=>typeof m!=='string' || !/^[a-z][a-z0-9-]{0,63}$/.test(m))) throw new Error('Unsupported book application manifest');
  resourcePath(value.entry,files);
  if(!value.entry.endsWith('.html') || files[value.entry]>2*1024*1024) throw new Error('Invalid application entry');
  return value;
}
export function callArguments(method,args,manifest) {
  if(!manifest.methods.includes(method) || !Array.isArray(args) || args.length>8 || args.some(a=>typeof a!=='string' && !(Number.isInteger(a) && a>=0 && a<=0xffffffff)) || JSON.stringify(args).length>65536) throw new Error('Book operation denied');
  return args;
}
export function storageKey(rootHash,key) {
  if(!/^[a-f0-9]{64}$/.test(rootHash) || typeof key!=='string' || !/^[a-zA-Z0-9:_-]{1,64}$/.test(key)) throw new Error('Storage key denied');
  return `caf-app:${rootHash}:${key}`;
}
export function storageValue(value) {
  const serialized=JSON.stringify(value);
  if(serialized===undefined || serialized.length>4096) throw new Error('Storage value exceeds limit');
  return serialized;
}

// 通用、有限的 JSON 导出。宿主显示保存按钮，由用户点击触发下载。
export function exportFile(filename,text) {
  if(typeof filename!=='string' || !/^[\p{L}\p{N}_·・-]{1,70}\.json$/u.test(filename) || typeof text!=='string' || text.length>65536)throw new Error('Export denied');
  JSON.parse(text);return {filename,text};
}
