// 与任务帮助统一：TTY 使用 Cargo 风格颜色，管道、NO_COLOR 和 --no-color 为纯文本。
export function paint(text,style,stream=process.stdout){
  const enabled=stream.isTTY&&!('NO_COLOR' in process.env)&&process.env.TERM!=='dumb'&&process.env.CARGO_MAKE_DISABLE_COLOR!=='true';
  return enabled?`\x1b[${style}m${text}\x1b[0m`:String(text);
}
export function heading(title,detail=''){
  console.log('\n'+paint(title,'1'));
  if(detail)console.log(paint(detail,'2'));
  console.log();
}
export function status(label,message,kind='info',stream=process.stdout){
  const styles={ok:'1;32',error:'1;31',info:'1;36'};
  const width=Array.from(label).reduce((n,c)=>n+(/\p{Script=Han}/u.test(c)?2:1),0);
  stream.write(`${' '.repeat(Math.max(2,10-width))}${paint(label,styles[kind]||styles.info,stream)}  ${message}\n`);
}
export const commandLine=args=>args.map(s=>/^[\w./:@=+-]+$/.test(s)?s:JSON.stringify(s)).join(' ');
export const duration=milliseconds=>milliseconds<60000?`${(milliseconds/1000).toFixed(1)} 秒`:`${Math.floor(milliseconds/60000)} 分 ${Math.floor(milliseconds/1000)%60} 秒`;
