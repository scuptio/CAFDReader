// 宿主界面语言设置独立于书籍内容及其私有记录。
const translations={
  "设置与帮助": "Settings & help",
  "阅读器设置": "Reader settings",
  "界面语言": "UI language",
  "关于阅读器": "About Reader",
  "关于 CAFD Reader": "About CAFD Reader",
  "关闭信息": "Close information",
  "正在读取版本信息…": "Loading version information…",
  "程序版本": "App version",
  "实现对应的 CAFD 规范版本": "Implemented CAFD specification",
  "规范状态": "Specification status",
  "不稳定草案": "Unstable draft",
  "稳定": "Stable",
  "容器格式": "Container format",
  "文档能力": "Document capability",
  "应用协议": "App protocol",
  "当前规范尚未定版，草案之间不承诺向后兼容。": "This specification is a draft. Compatibility between drafts is not guaranteed.",
  "按已发布规范提供兼容支持。": "Compatibility follows the published specification.",
  "无法读取版本信息，请重新打开信息窗口重试。": "Unable to load version information. Close and reopen this window to retry.",
  "书架": "Library",
  "CAFD 阅读器": "CAFD Reader",
  "打开 .cafd": "Open .cafd",
  "关闭": "Close",
  "文档元信息": "Document information",
  "保存导出文件": "Save exported file",
  "取消导出": "Cancel export",
  "请打开 .cafd 文件。": "Open a .cafd file.",
  "导入 .cafd": "Import .cafd",
  "正在载入书架…": "Loading library…",
  "打开本地 .cafd 档案": "Open a local .cafd file",
  "请从书架选书，或打开本地 .cafd 文档。": "Choose a document from the library or open a local .cafd file.",
  "标题": "Title",
  "作者": "Author",
  "版本": "Version",
  "状态": "Status",
  "说明": "Description",
  "审校预览": "Editorial preview",
  "正在校验并打开 CAFD 文档…": "Verifying and opening CAFD document…",
  "此旧 CAF 未提供内置阅读应用；仅可查看元信息，不是完整的 CAFD 交互文档。": "This legacy CAF has no embedded reader app. Only document information is available.",
  "CAFD 文档应用": "CAFD document app",
  "开卷失败：书内应用连接逾时": "Unable to open: document app connection timed out.",
  "开卷失败：{error}": "Unable to open: {error}",
  "导入失败：{error}": "Import failed: {error}",
  "保存失败：{error}": "Save failed: {error}",
  "只支持 HTTP(S) 书籍网址，或手动打开本地 CAF。": "Only HTTP(S) document URLs are supported. You can also open a local CAF file.",
  "无效书籍网址：{error}": "Invalid document URL: {error}",
  "{title} · 封面": "{title} · Cover",
  "下载 CAFD": "Download CAFD",
  "从书架移除": "Remove from library",
  "仅从首页显示移除，不删除文件": "Hide from the library without deleting the file",
  "从书架移除《{title}》": "Remove “{title}” from library",
  "书架暂无书籍。": "The library is empty. ",
  "已从书架移除，文件仍保留在原位置。": "Removed from the library. The file remains in its original location.",
  "书架暂无书籍。已从书架移除，文件仍保留在原位置。": "The library is empty. Removed from the library; the file remains in its original location.",
  "移除失败：{error}": "Remove failed: {error}",
  "CAFD 交互文档，内含内容、资源与阅读应用。": "CAFD interactive documents include content, resources and a reader app.",
  "书架暂无书籍，可打开本地 CAFD 文档。": "The library is empty. Open a local CAFD document.",
  "正在校验并导入 CAFD 文档…": "Verifying and importing CAFD document…",
  "书架暂无书籍，请导入 CAFD 文档。": "The library is empty. Import a CAFD document.",
  "未选择文件。": "No file selected.",
  "无法保存语言设置，本次切换仍然有效。": "Unable to save the language preference. It still applies to this session.",
  "书架显示设置无效": "Invalid library display settings",
  "无法读取书架目录": "Unable to load the library catalog",
  "本地书籍标识无效": "Invalid local document ID",
  "书籍元信息无效": "Invalid document information",
  "此 CAF 未提供内置阅读应用，不能作为 CAFD 文档导入书架。": "This CAF has no embedded reader app and cannot be imported as a CAFD document."
};
const key='caf-reader:ui-language';
let language='zh-CN';
try{const saved=localStorage.getItem(key);if(saved==='en'||saved==='zh-CN')language=saved;}catch{}
const parameters=new WeakMap();
function diagnostic(message){
 const unsupported=/^此 CAF 容器不是本阅读器支持的 CAFD 文档（缺少 (.+)）$/.exec(message);
 if(language==='en'&&unsupported)return `This CAF container is not a supported CAFD document (missing ${unsupported[1]}).`;
 return language==='en'?(translations[message]??message):message;
}
export function t(message,values={}){return diagnostic(message).replace(/\{(\w+)\}/g,(_,name)=>name==='error'?diagnostic(String(values[name]??'')):String(values[name]??''));}
export function text(element,message,values={}){element.dataset.i18n=message;parameters.set(element,values);element.textContent=t(message,values);}
export function attribute(element,name,message,values={}){element.setAttribute('data-i18n-'+name,message);parameters.set(element,values);element.setAttribute(name,t(message,values));}
function refresh(){
 document.documentElement.lang=language;
 for(const element of document.querySelectorAll('[data-i18n]'))element.textContent=t(element.dataset.i18n,parameters.get(element));
 for(const name of ['title','alt','aria-label'])for(const element of document.querySelectorAll('[data-i18n-'+name+']'))element.setAttribute(name,t(element.getAttribute('data-i18n-'+name),parameters.get(element)));
 const select=document.getElementById('uiLanguage');if(select)select.value=language;
}
refresh();
const select=document.getElementById('uiLanguage');
if(select)select.onchange=()=>{
 if(!['zh-CN','en'].includes(select.value))return;
 language=select.value;let saved=true;
 try{localStorage.setItem(key,language);}catch{saved=false;}
 refresh();window.dispatchEvent(new Event('caf-language-change'));
 const status=document.getElementById('languageStatus');if(status)text(status,saved?'':'无法保存语言设置，本次切换仍然有效。');
};
