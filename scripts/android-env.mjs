import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

// 只对 Android 子命令使用项目配置，不改调用终端或用户全局环境。
export function androidEnvironment(settings,base=process.env,platform=process.platform){
  if(settings.schema_version!==1||settings.platform!==platform)throw Error('Android configuration version or platform mismatch; run cargo make setup-android again.');
  const keys=['JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','NDK_HOME'];
  if(!settings.env||keys.some(key=>typeof settings.env[key]!=='string'||!settings.env[key])||!Array.isArray(settings.path)||settings.path.some(p=>typeof p!=='string'||!p))throw Error('Invalid Android environment configuration; run cargo make setup-android again.');
  const env={...base};
  for(const key of keys)env[key]=settings.env[key];
  // 按目标平台选择分隔符，跨平台验证时不能使用宿主的 path.delimiter。
  const separator=platform==='win32'?';':':';
  // Windows 环境变量名不区分大小写，保留原 PATH 键的拼写。
  const pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';
  env[pathKey]=[...settings.path,env[pathKey]].filter(Boolean).join(separator);
  return env;
}

export function loadAndroidEnvironment(root){
  const file=resolve(root,'build/android-env.json');
  if(!existsSync(file))return;
  let settings;try{settings=JSON.parse(readFileSync(file,'utf8'));}catch{throw Error('Unable to read Android environment configuration; run cargo make setup-android again.');}
  Object.assign(process.env,androidEnvironment(settings));
}
