import {readFileSync,existsSync} from 'node:fs';
import {delimiter,resolve} from 'node:path';

// 只对 Android 子命令使用项目配置，不改调用终端或用户全局环境。
export function androidEnvironment(settings,base=process.env,platform=process.platform){
  if(settings.schema_version!==1||settings.platform!==platform)throw Error('Android 配置版本或平台不匹配，请重新运行 cargo make setup-android。');
  const keys=['JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','NDK_HOME'];
  if(!settings.env||keys.some(key=>typeof settings.env[key]!=='string'||!settings.env[key])||!Array.isArray(settings.path)||settings.path.some(p=>typeof p!=='string'||!p))throw Error('Android 环境配置无效，请重新运行 cargo make setup-android。');
  const env={...base};
  for(const key of keys)env[key]=settings.env[key];
  const separator=platform==='win32'?';':delimiter;
  // Windows 环境变量名不区分大小写，保留原 PATH 键的拼写。
  const pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';
  env[pathKey]=[...settings.path,env[pathKey]].filter(Boolean).join(separator);
  return env;
}

export function loadAndroidEnvironment(root){
  const file=resolve(root,'build/android-env.json');
  if(!existsSync(file))return;
  let settings;try{settings=JSON.parse(readFileSync(file,'utf8'));}catch{throw Error('无法读取 Android 环境配置，请重新运行 cargo make setup-android。');}
  Object.assign(process.env,androidEnvironment(settings));
}
