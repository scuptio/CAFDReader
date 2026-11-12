# CAFD — CAF Document

> [English](../en/CAFD.md) | 简体中文

规范版本：1.0.0。规范与阅读器产品版本独立维护。

CAFD 是基于 CAF 容器的交互文档约定，扩展名 `.cafd`，中文称“CAF 交互文档”。文档可承载文字、图像、数据、字体和内置交互应用；古籍电子书只是可承载的内容类型之一，CAFD 不限定为书籍。

## 容器与支持范围

- 底层字节格式仍为 CAF，魔数 `CAF\0`、格式版本、哈希、签名与校验规则不变；继续用 `caf-tool build/verify/inspect`。
- 当前 CAFD Reader 支持的阅读 profile 为 `caf:doc@1`，组件名 `ebook`；内置应用协议为 `caf:doc-web@1`。现有 `application/x-caf-ebook` payload 类型保留，不作为系统文件 MIME。
- 容器须实际声明支持的 capability，元信息须提供合法 `web_app_manifest`，应用清单须通过版本、入口路径、组件及操作范围校验。Worker 在实例化前检查要求的 capability；导入原生书架前也验证清单。
- `.cafd` 文件名不代表已校验或受支持。普通 CAF、未知 profile、未知应用协议或损坏文档应显示明确错误，不挂载应用，不加入原生活动书架。
- 当前约定复用阅读 profile，未来其他文档 profile 需另定版本与兼容能力，不能据此宣称现有阅读器可以打开所有 CAFD。

## 标识与扩展名

扩展名 `.cafd`，项目 MIME `application/x-cafd`，Apple 文档类型 `org.caf.document`。后缀不参与底层 CAF 字节校验，不表示文件可信。宿主必须校验能力和应用协议。

## 版本与兼容

版本 1.0.0 固定现有阅读 profile 与应用协议，不改 CAF 魔数或 ABI。只有明确声明并验证支持的 profile 才能运行。未来新 profile 与不兼容协议必须显式协商，不能据此宣称任意 CAF 均可打开。扩展名迁移可以保持容器字节、根哈希及个人记录不变。

能力和应用协议标识统一使用 `caf:doc@1` 与 `caf:doc-web@1`；宿主不接受旧命名标识。组件名 `ebook`、world `ebook-reader` 和函数 ABI 保持不变。修改容器内的能力或应用协议声明须重新打包与校验，会改变容器根哈希；按旧根哈希隔离的个人记录不会自动关联到新容器。

应用握手、能力边界、资源和存储限制见 [ebook-web v1](ebook-web-v1.md)。阅读器品牌、旧文件与数据兼容属于 [实现兼容说明](../../docs/zh-CN/compatibility.md)。
