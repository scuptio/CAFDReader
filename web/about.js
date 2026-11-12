import {text} from './i18n.js';
// 版本信息由构建脚本从程序和规范的版本源生成。
const dialog=document.createElement('dialog');
dialog.id='readerAbout';dialog.setAttribute('aria-labelledby','readerAboutTitle');
const title=document.createElement('h2');title.id='readerAboutTitle';text(title,'关于 CAFD Reader');
const status=document.createElement('p');status.setAttribute('role','status');
const details=document.createElement('dl');
const close=document.createElement('button');close.type='button';text(close,'关闭信息');
close.onclick=()=>dialog.close();
dialog.append(title,status,details,close);document.body.append(dialog);
const menu=document.getElementById('readerMenu');
const summary=menu.querySelector('summary');
document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus();event.preventDefault();}});
dialog.addEventListener('close',()=>summary.focus());
let loaded=false;
document.getElementById('btnAbout').onclick=async()=>{
  menu.open=false;
  summary.focus();
  dialog.showModal();
  if(loaded)return;
  text(status,'正在读取版本信息…');
  try{
    const response=await fetch(new URL('./app-info.json',import.meta.url));
    if(!response.ok)throw Error('无法读取版本信息');
    const info=await response.json();
    const rows=[['程序版本',info.version],['实现对应的 CAFD 规范版本',info.spec_version],['规范状态',info.spec_version.includes('-')?'不稳定草案':'稳定'],['容器格式',info.container],['文档能力',info.capability],['应用协议',info.application_protocol]];
    const fields=[];
    for(const [label,value] of rows){
      if(typeof value!=='string'||!value)throw Error('版本信息不完整');
      const term=document.createElement('dt');text(term,label);
      const definition=document.createElement('dd');text(definition,value);
      fields.push(term,definition);
    }
    details.replaceChildren(...fields);
    text(status,info.spec_version.includes('-')?'当前规范尚未定版，草案之间不承诺向后兼容。':'按已发布规范提供兼容支持。');
    loaded=true;
  }catch{text(status,'无法读取版本信息，请重新打开信息窗口重试。');}
};
