import {t} from '../i18n.js';
import {storageKey,storageValue} from '../reader/app-protocol.js';
const HIDDEN_BOOKS='caf-reader:shelf-hidden';
function hiddenBooks(){const value=JSON.parse(localStorage.getItem(HIDDEN_BOOKS)||'[]');if(!Array.isArray(value)||value.some(file=>typeof file!=='string'))throw new Error(t('书架显示设置无效'));return value;}

export function createBrowserPlatform(){return {
  native:false,
  cancelPending(){},
  async listBooks(){
    const response=await fetch('books/catalog.json');if(!response.ok)throw new Error(t('无法读取书架目录'));
    const hidden=new Set(hiddenBooks());
    return (await response.json()).filter(b=>typeof b.file==='string'&&!/[\/\\]/.test(b.file)&&/\.(cafd|caf)$/i.test(b.file)&&!hidden.has(b.file)).map(b=>({...b,href:'reader/?'+new URLSearchParams({book:'books/'+b.file}),coverURL:b.cover&&typeof b.cover.file==='string'&&/^[^/\\]+\.jpg$/.test(b.cover.file)?'books/'+encodeURIComponent(b.cover.file):null}));
  },
  async removeBook(book){localStorage.setItem(HIDDEN_BOOKS,JSON.stringify([...new Set([...hiddenBooks(),book.file])]));},
  source(){throw new Error(t('本地书籍标识无效'));},
  async importBook(){return null;},
  async consumeOpened(){return [];},
  async get(root,key){const value=localStorage.getItem(storageKey(root,key));return value===null?null:JSON.parse(value);},
  async set(root,key,value){const k=storageKey(root,key),text=storageValue(value),prefix=`caf-app:${root}:`;if(localStorage.getItem(k)===null&&Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length>=16)throw new Error('Book storage quota exceeded');localStorage.setItem(k,text);},
  async exportJSON(){return false;},
  async smoke(){return false;},
  async report(){}
};}
