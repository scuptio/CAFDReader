// npm 命令在 Windows 与 Unix 使用相应的 Python 可执行文件。
import {spawnSync} from 'node:child_process';
const command=process.env.CAF_PYTHON||(process.platform==='win32'?'python':'python3');
const args=process.argv.slice(2);
// cargo-make 会把任务参数中的分隔符也传下去；只在显式任务模式移除一个。
if(args[0]==='--cargo-make'){args.shift();const separator=args.indexOf('--');if(separator>=0)args.splice(separator,1);}
const result=spawnSync(command,args,{stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
if(result.error){console.error(`无法启动 ${command}，请设置 CAF_PYTHON。`);process.exit(1);}
process.exit(result.status??1);
