// 阅读器任务路由：不复制 Tauri / 宿主构建逻辑，也不启动电子书流水线。
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,delimiter,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {paint,heading,status,commandLine,duration} from './terminal.mjs';
import {loadAndroidEnvironment} from './android-env.mjs';

export const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const platforms=['linux','windows','macos','web','android','ios'];
export const hostPlatform=system=>({linux:'linux',win32:'windows',darwin:'macos'})[system];
const usage=`Usage: cargo make reader [platform] [--plan [--json]] [--dev | --release] [-- Tauri arguments]
Platforms: linux, windows, macos, web, android, ios; defaults to the host desktop.
Examples: cargo make reader linux
      cargo make reader android --plan
      cargo make reader linux -- --bundles deb
Defaults: unsigned desktop packages; Android aarch64 debug APK; iOS simulator for the host architecture.
Android release APK: cargo make reader android --release (configure signing separately).
Web output: dist-host; preview with python3 -m http.server 8611 --directory dist-host.
Toolchain check: cargo make doctor [platform]; development mode: cargo make dev [platform].`;

export function parseOptions(argv,system=process.platform){
  const separator=argv.indexOf('--'),head=separator<0?[...argv]:argv.slice(0,separator),tail=separator<0?[]:argv.slice(separator+1);
  const take=flag=>{const found=head.includes(flag);for(let i=head.length-1;i>=0;i--)if(head[i]===flag)head.splice(i,1);return found;};
  const plan=take('--plan'),json=take('--json'),dev=take('--dev'),release=take('--release'),doctor=take('--doctor'),help=take('--help')||take('-h');
  const platform=head[0]&&!head[0].startsWith('-')?head.shift():hostPlatform(system);
  if(!help&&!platforms.includes(platform))throw Error(`Unsupported platform: ${platform??system}. Available: ${platforms.join(', ')}`);
  if(release&&(platform!=='android'||dev||doctor))throw Error('--release is only supported for Android builds and cannot be combined with --dev / --doctor.');
  if(release&&[...head,...tail].includes('--debug'))throw Error('--release cannot be combined with --debug.');
  return {platform,plan,json,dev,release,doctor,help,extra:[...head,...tail]};
}

export function buildPlan(options,{system=process.platform,arch=process.arch,generated=p=>existsSync(resolve(root,p))}={}){
  const {platform,dev,release,extra=[]}=options,current=hostPlatform(system);
  if(!options.plan&&['linux','windows','macos'].includes(platform)&&platform!==current)throw Error(`${platform} desktop packages must be built on ${platform}; current host: ${current??system}.`);
  if(!options.plan&&platform==='ios'&&system!=='darwin')throw Error('iOS builds require macOS with Xcode.');
  if(platform==='web'){
    if(dev||extra.length)throw Error('Build web with cargo make reader web; preview using a static HTTP server.');
    return [{kind:'host',args:[]}];
  }
  if(platform==='android'||platform==='ios'){
    const steps=[],mobile=platform==='android'?'android':'apple';
    if(!generated(`src-tauri/gen/${mobile}`))steps.push({kind:'tauri',args:[platform,'init','--ci',...(process.env.CI?['--skip-targets-install']:[])]});
    const defaults=platform==='android'?['--apk']:['--no-sign'];
    const target=platform==='android'?'aarch64':arch==='arm64'?'aarch64-sim':'x86_64';
    const hasTarget=extra.some(a=>a==='--target'||a.startsWith('--target='));
    steps.push({kind:'tauri',args:[platform,dev?'dev':'build',...(!dev?[...(!release?['--debug']:[]),...defaults]:[]),...(!hasTarget?['--target',target]:[]),...extra]});
    return steps;
  }
  const args=[dev?'dev':'build',...(!dev?['--no-sign']:[]),...extra];
  const split=args.indexOf('--');
  if(split<0)args.push('--','--locked');else if(!args.slice(split+1).includes('--locked'))args.push('--locked');
  return [{kind:'tauri',args}];
}

function tauriCli(){
  let path;
  try{path=require.resolve('@tauri-apps/cli/package.json');}catch{throw Error('Local Tauri CLI not found; run npm ci in the project root first.');}
  const metadata=JSON.parse(readFileSync(path,'utf8'));
  return resolve(dirname(path),typeof metadata.bin==='string'?metadata.bin:metadata.bin.tauri);
}
function execute(command,args){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
  if(result.error)throw Error(`Unable to start ${command}: ${result.error.message}`);
  if(result.status!==0){process.exitCode=result.status??1;return false;}
  return true;
}
function findFile(directory,name){
  if(!existsSync(directory))return null;
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const child=join(directory,entry.name);
    if(entry.isFile()&&entry.name===name)return child;
    if(entry.isDirectory()){const found=findFile(child,name);if(found)return found;}
  }
  return null;
}
export function repairAndroidProject(projectRoot=root){
  const android=resolve(projectRoot,'src-tauri/gen/android');
  const task=findFile(resolve(android,'buildSrc/src/main'),'BuildTask.kt');
  if(!task)throw Error('Android project is missing BuildTask.kt; run android init again.');
  const marker='val args = listOf("tauri", "android", "android-studio-script");';
  const replacement='val cli = File(projectDir, "$rootDirRel/../node_modules/@tauri-apps/cli/tauri.js").canonicalPath\n        val args = listOf(cli, "android", "android-studio-script");';
  const source=readFileSync(task,'utf8');
  if(source.includes(marker))writeFileSync(task,source.replace(marker,replacement));
  else if(!source.includes('node_modules/@tauri-apps/cli/tauri.js'))throw Error('Unrecognized Tauri CLI invocation in Android BuildTask.kt.');
  const properties=resolve(android,'gradle.properties');
  const value=readFileSync(properties,'utf8');
  if(!/^kotlin\.incremental=false$/m.test(value))writeFileSync(properties,value.replace(/\s*$/,'')+'\n\n# Tauri dependencies and this project may reside on different Windows drives.\nkotlin.incremental=false\n');
  return task;
}
function executable(name){
  const extensions=process.platform==='win32'?(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';'):[''];
  return (process.env.PATH||'').split(delimiter).some(dir=>extensions.some(ext=>existsSync(join(dir,name+ext))));
}
export function doctor(platform){
  heading('Reader toolchain check',`Platform ${platform} · Read-only check`);
  let missing=0,total=0;
  const report=(name,ok,detail='')=>{status(ok?'Passed':'Missing',name+(detail?' · '+detail:''),ok?'ok':'error');total++;if(!ok)missing++;};
  report('Node.js 24+',Number(process.versions.node.split('.')[0])>=24,process.version);
  for(const name of ['npm','cargo','rustc','cargo-make'])report(name,executable(name));
  try{report('Local Tauri CLI',existsSync(tauriCli()));}catch(error){report('Local Tauri CLI',false,error.message);}
  const probe=(name,args)=>{const r=spawnSync(name,args,{cwd:root,encoding:'utf8'});return !r.error&&r.status===0&&!!(r.stdout||r.stderr).trim();};
  if(platform==='linux'){
    for(const library of ['gtk+-3.0','webkit2gtk-4.1'])report(library,probe('pkg-config',['--modversion',library]));
  }
  if(platform==='macos'||platform==='ios')report('Xcode',probe('xcode-select',['-p'])&&probe('xcrun',['--find','clang']));
  if(platform==='windows')console.log('Platform requirements: MSVC C++ Build Tools and WebView2; verify installation on Windows.');
  if(platform==='android'){
    const java=spawnSync('java',['-version'],{encoding:'utf8'}),version=(java.stderr||java.stdout||'').match(/version "(\d+)/)?.[1];
    report('Java 21+',!java.error&&java.status===0&&Number(version)>=21);
    const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
    report('Android SDK',!!sdk&&existsSync(sdk),'ANDROID_HOME / ANDROID_SDK_ROOT');
    report('Android NDK',!!process.env.NDK_HOME&&existsSync(process.env.NDK_HOME),'NDK_HOME');
  }
  console.log();
  status(missing?'Failed':'Passed',`${total-missing}/${total} checks passed${missing?`, ${missing} missing`:''}`,missing?'error':'ok');
  console.log(paint('  Tauri will also validate the target SDK, Rust target and signing configuration during the build.','2'));
  return missing===0;
}

const outputPath=platform=>({linux:'src-tauri/target/release/bundle/',windows:'src-tauri/target/release/bundle/',macos:'src-tauri/target/release/bundle/',web:'dist-host/',android:'src-tauri/gen/android/app/build/outputs/',ios:'src-tauri/gen/apple/build/'})[platform];
const stepCommand=step=>step.kind==='host'?['node','scripts/build_host.mjs']:['tauri',...step.args];
function showPlan(options,plan){
  heading('Reader build plan',`Platform ${options.platform} · ${options.dev?'Development':'Build'} · Preview only`);
  plan.forEach((step,index)=>{
    status(`${index+1}/${plan.length}`,step.kind==='host'?'Build static host':step.args[1]==='init'?'Initialize mobile project':options.dev?'Start development reader':'Build reader');
    console.log(paint('       '+commandLine(stepCommand(step)),'2'));
  });
  console.log();
  if(!options.dev)status('Output',outputPath(options.platform));
  console.log(paint('  This plan does not run a build; actual builds require the platform toolchain.','2'));
}

export function main(argv=process.argv.slice(2)){
  const options=parseOptions(argv);
  if(options.help){console.log(usage);return;}
  if(options.json&&!options.plan)throw Error('--json requires --plan.');
  if(options.platform==='android'&&!options.plan)loadAndroidEnvironment(root);
  if(options.doctor){
    if(options.extra.length||options.dev||options.plan)throw Error('doctor accepts only one optional platform name.');
    buildPlan({...options,extra:[]});
    if(!doctor(options.platform))process.exitCode=1;return;
  }
  const plan=buildPlan(options);
  if(options.plan){if(options.json)console.log(JSON.stringify({platform:options.platform,mode:options.dev?'dev':'build',steps:plan},null,2));else showPlan(options,plan);return;}
  heading('CAFD Reader',`Platform ${options.platform} · ${options.dev?'Development':'Build'}`);
  const started=Date.now();
  for(const [index,step] of plan.entries()){
    if(options.platform==='android'&&step.kind==='tauri'&&step.args[0]==='android'&&['build','dev'].includes(step.args[1]))repairAndroidProject();
    status(`${index+1}/${plan.length}`,commandLine(stepCommand(step)));
    const args=step.kind==='host'?[resolve(root,'scripts/build_host.mjs')]:[tauriCli(),...step.args];
    if(!execute(process.execPath,args)){status('Failed',`Step ${index+1}/${plan.length} · Exit code ${process.exitCode} · ${duration(Date.now()-started)}`,'error',process.stderr);return;}
    if(options.platform==='android'&&step.kind==='tauri'&&step.args[0]==='android'&&step.args[1]==='init')repairAndroidProject();
  }
  console.log();status('Finished',`${options.platform} · ${duration(Date.now()-started)}`,'ok');
  if(!options.dev)status('Output',outputPath(options.platform));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){status('Error',error.message,'error',process.stderr);process.exitCode=1;}
}
