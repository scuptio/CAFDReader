import {text,attribute} from './i18n.js';
// 书架只读静态元信息缓存，书籍内容与阅读界面全部来自 CAF。
import {platform} from './platform.js';
const shelf=document.getElementById('shelf');
try {
  const books=await platform.listBooks();
  for(const book of books) {
    const article=document.createElement('article');
    if(book.coverURL) {
      const coverLink=document.createElement('a');coverLink.className='cover-link';coverLink.href=book.href;
      const image=document.createElement('img');image.className='book-cover';image.src=book.coverURL;attribute(image,'alt','{title} · 封面',{title:book.title});image.loading='lazy';image.decoding='async';
      image.addEventListener('error',()=>coverLink.remove(),{once:true});coverLink.appendChild(image);article.appendChild(coverLink);
    }
    const heading=document.createElement('h2');
    const link=document.createElement('a');link.textContent=book.title;link.href=book.href;heading.appendChild(link);
    const author=document.createElement('p');author.textContent=book.author || '';
    const status=document.createElement('p');if(book.quality==='editorial-preview')text(status,'审校预览');else status.textContent=book.quality||'';
    const download=document.createElement('a');text(download,'下载 CAFD');download.href='books/'+encodeURIComponent(book.file);download.download=book.file;
    const hash=document.createElement('small');hash.textContent='SHA-256 '+book.sha256;
    const remove=document.createElement('button');remove.type='button';remove.className='remove-book';text(remove,'从书架移除');attribute(remove,'title','仅从首页显示移除，不删除文件');attribute(remove,'aria-label','从书架移除《{title}》',{title:book.title});
    remove.onclick=async()=>{remove.disabled=true;try{await platform.removeBook(book);article.remove();text(document.getElementById('shelfStatus'),shelf.children.length?'已从书架移除，文件仍保留在原位置。':'书架暂无书籍。已从书架移除，文件仍保留在原位置。');}catch(error){remove.disabled=false;text(document.getElementById('shelfStatus'),'移除失败：{error}',{error:error.message});}};
    article.append(heading,author,status,...(platform.native?[]:[download]),remove,hash);shelf.appendChild(article);
  }
  text(document.getElementById('shelfStatus'),shelf.children.length ? '' : '书架暂无书籍，可打开本地 CAFD 文档。');
} catch(error) {document.getElementById('shelfStatus').textContent=error.message;}

async function importNative(opened=false){const status=document.getElementById('shelfStatus');try{text(status,'正在校验并导入 CAFD 文档…');const book=opened?(await platform.consumeOpened()).at(-1):await platform.importBook();if(book)location.href='reader/index.html?'+new URLSearchParams({library:book.id});else text(status,opened?(shelf.children.length?'':'书架暂无书籍，请导入 CAFD 文档。'):'未选择文件。');}catch(error){text(status,'导入失败：{error}',{error:error.message});await platform.report({ok:false,error:error.message});}}
if(platform.native){document.getElementById('btnImport').hidden=false;document.getElementById('btnImport').onclick=()=>importNative();window.addEventListener('caf-native-open',()=>importNative(true));await importNative(true);}
