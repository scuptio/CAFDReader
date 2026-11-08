# 实现兼容

CAFD Reader 产品版本 0.2.0，程序 cafd-reader，库 cafd_reader_lib。应用 identifier `org.caf.reader`、cafbook/cafcover URI scheme、caf-app 根哈希存储键保持稳定，以继承旧书架。

系统只关联 .cafd，手动选择和桌面命令行兼容 .caf。旧数据 profile 在浏览器仅查看元信息；原生书架只接受包含合法内置应用的文档。新文件保存为 hash.cafd，读取可回退旧 hash.caf，去重和个人记录沿用原哈希。浏览器 localStorage 与原生私有目录分别保存，不混用。

此仓库不包含图书内容、编辑流水线或书内排版应用，不需要李白项目或 PDF 才能构建、运行测试。文档生产者只通过规范和生成的 Web 发布产物集成。
