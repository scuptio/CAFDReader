import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
const root=new URL('./fixtures/',import.meta.url),base=process.env.BASE||'http://127.0.0.1:8612';
const file=name=>fileURLToPath(new URL(name,root));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(30000);
  const workers=new Set();page.on('worker',w=>{workers.add(w);w.on('close',()=>workers.delete(w));});
  await page.goto(base+'/reader/');assert.equal(await page.locator('#fileInput').getAttribute('accept'),'.cafd,.caf');
  async function opened(input){
   await page.setInputFiles('#fileInput',input);await page.waitForSelector('#bookApp');
   const frame=await(await page.locator('#bookApp').elementHandle()).contentFrame();
   await frame.waitForFunction(()=>document.querySelector('#fixture-result')?.textContent.startsWith('{'));
   return JSON.parse(await frame.textContent('#fixture-result'));
  }
  const first=await opened(file('reader.cafd'));
  for(const key of ['parent','storage','network'])assert.equal(first[key],'denied');
  for(const key of ['badKey','method','traversal','missing','large','unknown'])assert.equal(first[key].ok,false,key);
  assert.equal(first.self,true);assert.equal(first.previous.value,null);assert.deepEqual(first.read.value,{value:42});assert.equal(first.other.value,null);assert.equal(first.info.value.title,'交互文档验证');assert.equal(await page.locator('#metadata-injection').count(),0);
  const hash=await page.locator('#bookMeta dd').last().textContent();
  await page.click('#btnClose');await page.waitForFunction(()=>!document.querySelector('#bookApp'));await page.waitForTimeout(100);assert.equal(workers.size,0);
  const again=await opened({name:'旧后缀.caf',mimeType:'application/octet-stream',buffer:await readFile(file('reader.cafd'))});
  assert.equal(await page.locator('#bookMeta dd').last().textContent(),hash);assert.deepEqual(again.previous.value,{value:42});
  for(const [name,message] of [['unsupported.cafd','不是本阅读器支持'],['future.cafd','Unsupported book application manifest']]){
   await page.setInputFiles('#fileInput',file(name));await page.waitForFunction(text=>document.querySelector('#hostStatus').textContent.includes(text),message);assert.equal(await page.locator('#bookApp').count(),0);
  }
  await page.setInputFiles('#fileInput',file('legacy.caf'));await page.waitForFunction(()=>document.querySelector('#hostStatus').textContent.includes('未提供内置阅读应用'));assert.ok(await page.locator('#bookMetadata').isVisible());
  await page.setInputFiles('#fileInput',{name:'损坏.cafd',buffer:Buffer.from('invalid'),mimeType:'application/octet-stream'});await page.waitForFunction(()=>document.querySelector('#hostStatus').textContent.startsWith('开卷失败'));assert.equal(await page.locator('#bookApp').count(),0);
  await opened(file('reader.cafd'));await page.click('#btnClose');await page.waitForTimeout(100);assert.equal(workers.size,0);
  await page.close();console.log(`PASS ${width}px 独立 CAFD、旧后缀、协议拒绝、隔离、记录恢复与关闭释放`);
 }
}finally{await browser.close();}
