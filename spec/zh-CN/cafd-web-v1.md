# caf:doc-web@1

> [English](../en/cafd-web-v1.md) | 简体中文

当前规范为 **1.0.0-draft.1（不稳定草案）**，尚未定版，不承诺草案之间向后兼容；字段、组件名、world、ABI 和协议约定仍可能调整。程序版本与规范版本独立维护。

规范版本 1.0.0-draft.1。当前阅读文档 profile 为 caf:doc@1;WASM 数据接口由文档提供,宿主不解释排版或篇章。

## 发现与挂载

info() 返回 JSON 元信息,web_app_manifest 字段指向 /app/manifest.json。
清单结构:
  {"protocol":"caf:doc-web@1","component":"cafd","entry":"/app/index.html",
   "methods":["info","toc","get","window","search","lookup","entity"],"sources":{...}}
v1 HTML 入口自包含脚本与样式,不引用远端脚本、外部样式或嵌套框架。
宿主经 CAF Worker 校验后读取元信息、清单和 HTML;未知协议或不合法路径拒绝挂载。
旧 CAF 无 web_app_manifest 时可浏览元信息,没有宿主排版降级分支。

## 启动握手

1. 宿主创建 sandbox="allow-scripts" 的 iframe,注入受宿主管理的 CSP 与脚本 nonce。
2. 书内发送 {type:"caf-app-ready",protocol:"caf:doc-web@1"} 给 parent。
3. 宿主只接受当前 iframe 的一次握手,传入私有 MessagePort、info 和完整 rootHash。
4. 书内客户端在端口上发送 {id,op,...},接收 {id,ok,value} 或 {id,ok:false,error}。

不以 null origin 字符串作信任依据;校验 event.source 与实际当前 frame 对象。
端口建立后不在全局 window message 上接受能力请求。

## 端口操作

call:{method,args};仅清单中声明的方法,最多 8 个字符串/u32 参数,总序列化长度
  最多 65536 个字符。实际执行在串行队列的 WASM Worker 中。
read:{path};只读当前书籍实际存在的绝对 payload 路径,拒绝点路径、反斜杠、
  空字符、缺失资源和超限资源;结果为可转移的 ArrayBuffer。
storage:get:{key};返回当前 rootHash 下的小型 JSON 值,无值时返回 null。
storage:set:{key,value};键只接受 1–64 位字母/数字/:/_/-,JSON 最多 4096 字符;
  每书最多 16 个键,命名空间为 caf-app:<完整根哈希>:<key>。
不提供任意宿主存储、联网、打开另一书籍、弹窗、宿主 DOM 等接口。

## 限制与生命周期

单资源最多 32 MiB,应用清单最多 64 KiB,HTML 入口最多 2 MiB,端口最多并发 8 请求。
Worker 单次执行操作超时 15 秒,初次网络打开限时 60 秒;失败/终止会拒绝全部待处理调用;应用握手限时 10 秒。
关闭、换书或加载取消时先废弃当前会话,再关闭端口、销毁 iframe 并终止 Worker;
迟到响应不能更新界面或重新挂载。应用创建的 Blob URL 随文档销毁而释放。
CSP 限制外部脚本/样式、fetch 等联网接口,图片、字体与音视频来自书内字节或 Blob URL。
iframe 隔离 DOM 和直接存储访问,不提供确定性的 JS CPU 计量;WASM 的可终止性
由 Worker 保障。v1 以现代浏览器的模块 Worker、iframe sandbox 和 MessageChannel 为基准。

## 纯静态与离线

宿主通过本地或远程静态 HTTP 提供;本地 CAF 用文件选择或拖到宿主区域打开。
不需要业务服务、数据库、登录或 CDN。书内资源经端口从选中的 CAF 读取。
不承诺 file:// 双击宿主 HTML 可运行 ES module 与 Worker,也未实现浏览器 PWA 缓存。
打开本地 CAF 不下载远端书籍;打开不等于把 .cafd 解压成站点上的阅读应用。
