import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);if(args[1]==='--')args.splice(1,1);
const suite=args.shift()||'unit';
const cases={unit:['tests/lazy-source.spec.mjs','tests/fixtures.spec.mjs','tests/app-protocol.spec.mjs','tests/reader-build-logic.mjs','tests/android-setup.spec.mjs','scripts/check_js.mjs'],browser:['tests/host.spec.mjs']};
if(!cases[suite]||args.length){console.error('用法：node scripts/test.mjs unit|browser');process.exitCode=2;}
else for(const file of cases[suite]){const result=spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit'});if(result.error){console.error(result.error.message);process.exitCode=1;break;}if(result.status!==0){process.exitCode=result.status??1;break;}}
