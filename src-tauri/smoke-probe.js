// 仅 --smoke 验证模式注入，发布时的书内应用不需要此脚本。
if(window!==top){
  let sent=false;
  const send=result=>{if(!sent){sent=true;parent.postMessage({type:'caf-native-probe',result},'*');}};
  const run=async()=>{
    const start=performance.now();
    while(!document.querySelector('.cover .tag,[data-caf-ready]') || document.querySelector('[data-caf-ready="false"]') || document.fonts.status!=='loaded'){
      if(performance.now()-start>60000){send({ok:false,error:'原生 WebView 中书页未完成显示'});return;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    await new Promise(resolve=>setTimeout(resolve,5000));
    const result={ok:true,visible:document.body.getBoundingClientRect().height>0,fontsReady:true,tokenAbsent:!window.__CAF_NATIVE_SESSION__};
    try{parent.document.body;result.parentBlocked=false;}catch{result.parentBlocked=true;}
    try{await fetch('https://example.invalid/');result.networkBlocked=false;}catch{result.networkBlocked=true;}
    if(window.__TAURI_INTERNALS__){
      try{await window.__TAURI_INTERNALS__.invoke('library_list',{token:'invalid-book-token'});result.nativeDenied=false;}catch{result.nativeDenied=true;}
    }else result.nativeDenied=true;
    result.ok=Object.values(result).every(v=>v===true);
    send(result);
  };
  if(document.readyState==='complete')run();else addEventListener('load',run,{once:true});
}
