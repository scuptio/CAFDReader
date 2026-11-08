// 薄宿主：打开/关闭 CAF、元信息、沙箱挂载及通用能力桥接。
import {openCafWorker} from './caf.js';
import {platform} from '../platform.js';
import {APP_PROTOCOL,DOCUMENT_CAPABILITY,documentManifest,resourcePath,callArguments,exportFile} from './app-protocol.js';
const $=id=>document.getElementById(id);
const decoder=new TextDecoder();
let active=null;
let sequence=0;

function closeBook(message='请从书架选书，或打开本地 .cafd 文档（兼容旧 .caf）。') {
  sequence++;platform.cancelPending();
  clearExport();
  const session=active;active=null;
  if(session) {clearTimeout(session.mountTimer);if(session.port){session.port.onmessage=null;session.port.close();}session.cancel?.();session.frame?.remove();}
  $('bookFrameSlot').replaceChildren();
  $('bookMeta').replaceChildren();$('bookMetadata').hidden=true;
  $('btnClose').disabled=true;$('hostTitle').textContent='CAFD 阅读器';
  $('hostStatus').textContent=message;$('hostStatus').hidden=false;
  document.title='CAFD 阅读器';
}

function showMetadata(info,artifact) {
  const box=$('bookMeta');box.replaceChildren();
  for(const [name,value] of [['标题',info.title || artifact.name],['作者',info.author],['版本',artifact.version],['状态',info.quality==='editorial-preview' ? '审校预览' : info.quality],['说明',info.note],['根杂凑',artifact.rootHash]]) {
    if(value===undefined)continue;
    const term=document.createElement('dt');term.textContent=name;
    const definition=document.createElement('dd');definition.textContent=String(value);
    box.append(term,definition);
  }
  $('bookMetadata').hidden=false;
  $('hostTitle').textContent=info.title || artifact.name;
  document.title=$('hostTitle').textContent;
}

function sandboxDocument(html) {
  const doc=new DOMParser().parseFromString(html,'text/html');
  if(doc.querySelector('script[src],link[rel="stylesheet"],base,meta[http-equiv="refresh" i],iframe,frame,object,embed')) throw new Error('Application entry must be self-contained');
  // CSP 始终由宿主置于最前，书内代码不能申请同源或联网权限。
  doc.querySelectorAll('meta[http-equiv="content-security-policy" i]').forEach(el=>el.remove());
  const nonce=crypto.randomUUID().replaceAll('-','');
  const policy=document.createElement('meta');policy.httpEquiv='Content-Security-Policy';
  policy.content=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' 'unsafe-inline'; style-src-attr 'unsafe-inline'; img-src blob: data:; font-src blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'`;
  doc.querySelectorAll('script,style').forEach(el=>el.setAttribute('nonce',nonce));
  doc.head.prepend(policy);
  return '<!doctype html>\n'+doc.documentElement.outerHTML;
}

async function bridgeRequest(session,request) {
  if(active!==session) throw new Error('Book session closed');
  if(!request || !Number.isSafeInteger(request.id) || request.id<1) throw new Error('Invalid bridge request');
  if(request.op==='call') return session.runtime.callPacked(request.method,...callArguments(request.method,request.args,session.manifest));
  if(request.op==='read') return session.runtime.readPayload(resourcePath(request.path,session.runtime.artifact.files));
  if(request.op==='file:export') {
    const file=exportFile(request.filename,request.text);clearExport();session.exportFile=file;session.exportUrl=URL.createObjectURL(new Blob([file.text],{type:'application/json'}));$('exportSave').href=session.exportUrl;$('exportSave').download=file.filename;$('exportFilename').textContent=file.filename;$('exportPanel').hidden=false;return true;
  }
  if(request.op==='storage:get') {
    return platform.get(session.runtime.artifact.rootHash,request.key);
  }
  if(request.op==='storage:set') {
    await platform.set(session.runtime.artifact.rootHash,request.key,request.value);return true;
  }
  throw new Error('Unknown bridge operation');
}

function connectFrame(event) {
  const session=active;
  if(!session?.frame || event.source!==session.frame.contentWindow || event.data?.type!=='caf-app-ready' || event.data.protocol!==APP_PROTOCOL || session.port) return;
  clearTimeout(session.mountTimer);
  const channel=new MessageChannel();session.port=channel.port1;
  let inFlight=0;
  session.port.onmessage=async({data})=>{
    if(active!==session || !Number.isSafeInteger(data?.id))return;
    if(inFlight>=8) {session.port.postMessage({id:data.id,ok:false,error:'Too many pending book requests'});return;}
    inFlight++;
    try {
      const value=await bridgeRequest(session,data);
      if(active===session) session.port.postMessage({id:data.id,ok:true,value},value instanceof ArrayBuffer ? [value] : []);
    } catch(error) {
      if(active===session) session.port.postMessage({id:data.id,ok:false,error:error.message});
    } finally {inFlight--;}
  };
  session.port.start();
  session.frame.contentWindow.postMessage({type:'caf-app-connect',protocol:APP_PROTOCOL,info:session.info,rootHash:session.runtime.artifact.rootHash},'*',[channel.port2]);
  $('hostStatus').hidden=true;
}
window.addEventListener('message',connectFrame);

// 原生验收模式由平台注入只读探针；正常书籍不需要发送此事件。
window.addEventListener('message',async event=>{
  const session=active;
  if(!session?.frame || event.source!==session.frame.contentWindow || event.data?.type!=='caf-native-probe' || !await platform.smoke())return;
  try{
    const root=session.runtime.artifact.rootHash;
    const previousStarts=(await platform.get(root,'native-smoke'))?.starts||0;
    await platform.set(root,'native-smoke',{verified:true,starts:previousStarts+1});
    const persisted=(await platform.get(root,'native-smoke'))?.verified===true;
    const isolated=await platform.get('0'.repeat(64),'native-smoke')===null;
    const response=await fetch(session.input,{headers:{Range:'bytes=0-3'}}),head=new Uint8Array(await response.arrayBuffer());
    const range=response.status===206 && head.length===4 && head[0]===67&&head[1]===65&&head[2]===70&&head[3]===0;
    await platform.report({...event.data.result,ok:event.data.result.ok&&persisted&&isolated&&range,rootHash:root,title:session.info.title,wasm:true,embeddedApp:true,persisted,isolated,range,previousStarts,sandbox:session.frame.getAttribute('sandbox')});
  }catch(error){await platform.report({ok:false,error:error.message});}
});


async function openBook(input) {
  closeBook('正在校验并打开 CAFD 文档…');
  const session={id:++sequence,input};active=session;$('btnClose').disabled=false;
  try {
    const opening=openCafWorker(input,{component:'ebook',requiredCapability:DOCUMENT_CAPABILITY,timeout:15000});session.cancel=()=>opening.terminate();
    session.runtime=await opening;
    if(active!==session)return;
    session.info=await session.runtime.callPacked('info');
    if(!session.info || typeof session.info!=='object' || session.info.error) throw new Error(session.info?.error || 'Invalid book metadata');
    showMetadata(session.info,session.runtime.artifact);
    session.manifest=await documentManifest(session.runtime,session.info);
    if(!session.manifest) {$('hostStatus').textContent='此旧 CAF 未提供内置阅读应用；仅可查看元信息，不是完整的 CAFD 交互文档。';return;}
    const html=decoder.decode(await session.runtime.readPayload(session.manifest.entry));
    if(active!==session)return;
    const frame=document.createElement('iframe');frame.id='bookApp';frame.name='caf-book-app';frame.title=session.info.title || 'CAFD 文档应用';
    frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
    session.frame=frame;
    frame.srcdoc=sandboxDocument(html);
    session.mountTimer=setTimeout(()=>{if(active===session && !session.port)closeBook('开卷失败：书内应用连接逾时');},10000);
    $('bookFrameSlot').replaceChildren(frame);
  } catch(error) {
    if(active===session){closeBook('开卷失败：'+error.message);platform.report({ok:false,error:error.message}).catch(console.error);}
  }
}

$('btnOpen').onclick=async()=>{if(!platform.native){$('fileInput').click();return;}const intent=++sequence;try{const book=await platform.importBook();if(book&&intent===sequence)await openBook(platform.source(book.id));}catch(error){if(intent===sequence)closeBook('导入失败：'+error.message);}};
$('fileInput').onchange=event=>{const file=event.target.files[0];if(file)openBook(file);event.target.value='';};
$('btnClose').onclick=()=>closeBook();
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)openBook(file);});
window.addEventListener('pagehide',()=>closeBook());
const book=new URLSearchParams(location.search).get('book');
const library=new URLSearchParams(location.search).get('library');
if(library) {try{await openBook(platform.source(library));}catch(error){closeBook(error.message);}}
else if(book) {
  try {
    const url=new URL(book,new URL('../',location.href));
    if(!['http:','https:'].includes(url.protocol))closeBook('只支持 HTTP(S) 书籍网址，或手动打开本地 CAF。');
    else openBook(url.href);
  } catch(error) {closeBook('无效书籍网址：'+error.message);}
} else closeBook();

function clearExport(){if(active)active.exportFile=null;if(active?.exportUrl){URL.revokeObjectURL(active.exportUrl);active.exportUrl=null;}$('exportSave').removeAttribute('href');$('exportPanel').hidden=true;}
$('exportCancel').onclick=clearExport;
$('exportSave').addEventListener('click',async event=>{if(platform.native){event.preventDefault();try{const file=active?.exportFile;if(file&&await platform.exportJSON(file.filename,file.text))clearExport();}catch(error){$('exportFilename').textContent='保存失败：'+error.message;}return;}const url=active?.exportUrl;setTimeout(()=>{if(active?.exportUrl===url)clearExport();},1000);});

async function openedNativeFiles(){if(!platform.native)return;const intent=++sequence;try{const books=await platform.consumeOpened();if(books.length&&intent===sequence)await openBook(platform.source(books.at(-1).id));}catch(error){if(intent===sequence){closeBook('导入失败：'+error.message);await platform.report({ok:false,error:error.message});}}}
window.addEventListener('caf-native-open',openedNativeFiles);await openedNativeFiles();
