// 阅读器任务路由：不复制 Tauri / 宿主构建逻辑，也不启动电子书流水线。
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve,delimiter,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {paint,heading,status,commandLine,duration} from './terminal.mjs';

export const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const platforms=['linux','windows','macos','web','android','ios'];
export const hostPlatform=system=>({linux:'linux',win32:'windows',darwin:'macos'})[system];
const usage=`用法：cargo make reader [platform] [--plan [--json]] [--dev] [-- Tauri 参数]
平台：linux、windows、macos、web、android、ios；省略时使用本机桌面平台。
示例：cargo make reader linux
      cargo make reader android --plan
      cargo make reader linux -- --bundles deb
桌面默认构建未签名验证包；Android 默认 aarch64 调试 APK；iOS 默认本机架构模拟器。
web 输出 dist-host；预览用 python3 -m http.server 8611 --directory dist-host。
环境检查：cargo make doctor [platform]；开发模式：cargo make dev [platform]。`;

export function parseOptions(argv,system=process.platform){
  const separator=argv.indexOf('--'),head=separator<0?[...argv]:argv.slice(0,separator),tail=separator<0?[]:argv.slice(separator+1);
  const take=flag=>{const found=head.includes(flag);for(let i=head.length-1;i>=0;i--)if(head[i]===flag)head.splice(i,1);return found;};
  const plan=take('--plan'),json=take('--json'),dev=take('--dev'),doctor=take('--doctor'),help=take('--help')||take('-h');
  const platform=head[0]&&!head[0].startsWith('-')?head.shift():hostPlatform(system);
  if(!help&&!platforms.includes(platform))throw Error(`不支持的平台：${platform??system}。可用：${platforms.join('、')}`);
  return {platform,plan,json,dev,doctor,help,extra:[...head,...tail]};
}

export function buildPlan(options,{system=process.platform,arch=process.arch,generated=p=>existsSync(resolve(root,p))}={}){
  const {platform,dev,extra=[]}=options,current=hostPlatform(system);
  if(!options.plan&&['linux','windows','macos'].includes(platform)&&platform!==current)throw Error(`${platform} 桌面包须在 ${platform} 系统构建；当前为 ${current??system}。`);
  if(!options.plan&&platform==='ios'&&system!=='darwin')throw Error('iOS 构建须在配有 Xcode 的 macOS 上执行。');
  if(platform==='web'){
    if(dev||extra.length)throw Error('web 使用 cargo make reader web 构建，预览请运行静态 HTTP 服务。');
    return [{kind:'host',args:[]}];
  }
  if(platform==='android'||platform==='ios'){
    const steps=[],mobile=platform==='android'?'android':'apple';
    if(!generated(`src-tauri/gen/${mobile}`))steps.push({kind:'tauri',args:[platform,'init','--ci',...(process.env.CI?['--skip-targets-install']:[])]});
    const defaults=platform==='android'?['--apk']:['--no-sign'];
    const target=platform==='android'?'aarch64':arch==='arm64'?'aarch64-sim':'x86_64';
    const hasTarget=extra.some(a=>a==='--target'||a.startsWith('--target='));
    steps.push({kind:'tauri',args:[platform,dev?'dev':'build',...(!dev?['--debug',...defaults]:[]),...(!hasTarget?['--target',target]:[]),...extra]});
    return steps;
  }
  const args=[dev?'dev':'build',...(!dev?['--no-sign']:[]),...extra];
  const split=args.indexOf('--');
  if(split<0)args.push('--','--locked');else if(!args.slice(split+1).includes('--locked'))args.push('--locked');
  return [{kind:'tauri',args}];
}

function tauriCli(){
  let path;
  try{path=require.resolve('@tauri-apps/cli/package.json');}catch{throw Error('缺少本地 Tauri CLI，请先在项目根目录执行 npm ci。');}
  const metadata=JSON.parse(readFileSync(path,'utf8'));
  return resolve(dirname(path),typeof metadata.bin==='string'?metadata.bin:metadata.bin.tauri);
}
function execute(command,args){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
  if(result.error)throw Error(`无法启动 ${command}：${result.error.message}`);
  if(result.status!==0){process.exitCode=result.status??1;return false;}
  return true;
}
function executable(name){
  const extensions=process.platform==='win32'?(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';'):[''];
  return (process.env.PATH||'').split(delimiter).some(dir=>extensions.some(ext=>existsSync(join(dir,name+ext))));
}
export function doctor(platform){
  heading('阅读器环境检查',`平台 ${platform} · 只读检查`);
  let missing=0,total=0;
  const report=(name,ok,detail='')=>{status(ok?'通过':'缺少',name+(detail?' · '+detail:''),ok?'ok':'error');total++;if(!ok)missing++;};
  report('Node.js 24+',Number(process.versions.node.split('.')[0])>=24,process.version);
  for(const name of ['npm','cargo','rustc','cargo-make'])report(name,executable(name));
  try{report('本地 Tauri CLI',existsSync(tauriCli()));}catch(error){report('本地 Tauri CLI',false,error.message);}
  const probe=(name,args)=>{const r=spawnSync(name,args,{cwd:root,encoding:'utf8'});return !r.error&&r.status===0&&!!(r.stdout||r.stderr).trim();};
  if(platform==='linux'){
    for(const library of ['gtk+-3.0','webkit2gtk-4.1'])report(library,probe('pkg-config',['--modversion',library]));
  }
  if(platform==='macos'||platform==='ios')report('Xcode',probe('xcode-select',['-p'])&&probe('xcrun',['--find','clang']));
  if(platform==='windows')console.log('平台要求：MSVC C++ 构建工具与 WebView2；安装状态需在 Windows 环境确认。');
  if(platform==='android'){
    const java=spawnSync('java',['-version'],{encoding:'utf8'}),version=(java.stderr||java.stdout||'').match(/version "(\d+)/)?.[1];
    report('Java 21+',!java.error&&java.status===0&&Number(version)>=21);
    const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
    report('Android SDK',!!sdk&&existsSync(sdk),'ANDROID_HOME / ANDROID_SDK_ROOT');
    report('Android NDK',!!process.env.NDK_HOME&&existsSync(process.env.NDK_HOME),'NDK_HOME');
  }
  console.log();
  status(missing?'未通过':'通过',`${total-missing}/${total} 项检查通过${missing?`，缺少 ${missing} 项`:''}`,missing?'error':'ok');
  console.log(paint('  目标 SDK、Rust target 与签名配置由 Tauri 构建继续校验。','2'));
  return missing===0;
}

const outputPath=platform=>({linux:'src-tauri/target/release/bundle/',windows:'src-tauri/target/release/bundle/',macos:'src-tauri/target/release/bundle/',web:'dist-host/',android:'src-tauri/gen/android/app/build/outputs/',ios:'src-tauri/gen/apple/build/'})[platform];
const stepCommand=step=>step.kind==='host'?['node','scripts/build_host.mjs']:['tauri',...step.args];
function showPlan(options,plan){
  heading('阅读器构建计划',`平台 ${options.platform} · ${options.dev?'开发模式':'构建模式'} · 仅预览`);
  plan.forEach((step,index)=>{
    status(`${index+1}/${plan.length}`,step.kind==='host'?'构建静态宿主':step.args[1]==='init'?'初始化移动工程':options.dev?'启动开发版':'构建阅读器');
    console.log(paint('       '+commandLine(stepCommand(step)),'2'));
  });
  console.log();
  if(!options.dev)status('默认目录',outputPath(options.platform));
  console.log(paint('  此计划未执行构建；实际构建须满足对应平台环境。','2'));
}

export function main(argv=process.argv.slice(2)){
  const options=parseOptions(argv);
  if(options.help){console.log(usage);return;}
  if(options.json&&!options.plan)throw Error('--json 须与 --plan 一起使用。');
  if(options.doctor){
    if(options.extra.length||options.dev||options.plan)throw Error('doctor 只接受一个可选平台名。');
    buildPlan({...options,extra:[]});
    if(!doctor(options.platform))process.exitCode=1;return;
  }
  const plan=buildPlan(options);
  if(options.plan){if(options.json)console.log(JSON.stringify({platform:options.platform,mode:options.dev?'dev':'build',steps:plan},null,2));else showPlan(options,plan);return;}
  heading('CAFD 阅读器',`平台 ${options.platform} · ${options.dev?'开发模式':'构建模式'}`);
  const started=Date.now();
  for(const [index,step] of plan.entries()){
    status(`${index+1}/${plan.length}`,commandLine(stepCommand(step)));
    const args=step.kind==='host'?[resolve(root,'scripts/build_host.mjs')]:[tauriCli(),...step.args];
    if(!execute(process.execPath,args)){status('失败',`步骤 ${index+1}/${plan.length} · 退出码 ${process.exitCode} · ${duration(Date.now()-started)}`,'error',process.stderr);return;}
  }
  console.log();status('完成',`${options.platform} · ${duration(Date.now()-started)}`,'ok');
  if(!options.dev)status('默认目录',outputPath(options.platform));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){status('错误',error.message,'error',process.stderr);process.exitCode=1;}
}
