import {t} from '../i18n.js';
import {openCafWorker} from '../reader/caf.js';
import {storageKey,storageValue,DOCUMENT_CAPABILITY,documentManifest} from '../reader/app-protocol.js';

export async function createNativePlatform(){
  const api=await import('/native-api.js');
  const call=(command,args={})=>api.invoke(command,{...args,token:window.__CAF_NATIVE_SESSION__});
  const sourceURL=(id,scheme='cafbook')=>api.convertFileSrc(id,scheme)+'?'+new URLSearchParams({token:window.__CAF_NATIVE_SESSION__});
  let registering=null,smokeStatus;const validations=new Set();
  async function register(staged){
    const opening=openCafWorker(sourceURL(staged.id),{component:'cafd',requiredCapability:DOCUMENT_CAPABILITY});validations.add(opening);
    try {
      const runtime=await opening,info=await runtime.callPacked('info');
      if(!info||typeof info!=='object'||info.error)throw new Error(info?.error||t('书籍元信息无效'));
      if(!await documentManifest(runtime,info))throw new Error(t('此 CAF 未提供内置阅读应用，不能作为 CAFD 文档导入书架。'));
      let cover=null;
      if(info.cover?.path&&runtime.artifact.files[info.cover.path]<=1024*1024)cover=Array.from(new Uint8Array(await runtime.readPayload(info.cover.path)));
      return await call('library_commit',{book:{...staged,title:String(info.title||runtime.artifact.name),author:String(info.author||''),quality:String(info.quality||''),version:runtime.artifact.version,root_hash:runtime.artifact.rootHash},cover});
    }finally{validations.delete(opening);opening.terminate();}
  }
  return {
    native:true,
    cancelPending(){for(const opening of validations)opening.terminate();validations.clear();},
    async listBooks(){return (await call('library_list')).map(b=>({...b,sha256:b.id,href:'reader/index.html?'+new URLSearchParams({library:b.id}),coverURL:b.cover?sourceURL(b.id,'cafcover'):null}));},
    async removeBook(book){return call('library_remove',{id:book.id});},
    source(id){if(!/^[a-f0-9]{64}$/.test(id))throw new Error(t('本地书籍标识无效'));return sourceURL(id);},
    async importBook(){const staged=await call('library_import');return staged?register(staged):null;},
    async consumeOpened(){if(registering)return registering;registering=(async()=>{const books=[];for(;;){const pending=await call('opened_files');if(!pending.length)break;for(const book of pending)books.push(await register(book));}return books;})();try{return await registering;}finally{registering=null;}},
    async get(root,key){storageKey(root,key);return call('personal_get',{root,key});},
    async set(root,key,value){storageKey(root,key);storageValue(value);return call('personal_set',{root,key,value});},
    async exportJSON(filename,text){return call('export_json',{filename,text});},
    async smoke(){return smokeStatus??=call('smoke_config');},
    async report(result){if(await this.smoke())return call('smoke_result',{result});}
  };
}
