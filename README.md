# FreeMind

离线思维导图与工程文档写作工具。用节点组织章节，在备注里撰写图文资料，导出有标题层级和目录的 Word 文档。

## 当前版本 0.1.0

- 完整导图编辑、文件库、自动保存与 `.mmst` 本地文件。
- 节点备注支持直接粘贴截图；点击 **图文写作 · 粘贴图片与表格** 使用 Tiptap 图文编辑器。
- 图片以内嵌数据保存，随导图文件传递，无需图床。单图上限 10 MB；WebP/GIF 在本地转为 PNG，GIF 保留静态帧。
- 图文编辑器支持粘贴清理后的 HTML、表格、段落、列表、代码及图片。仅有远程链接而没有图片字节时会显示占位提示，不自动联网获取图片。
- 导出菜单的 **.docx (Word)** 输出封面、可点击目录、真实 Heading 1–9、章节编号、正文、图片、表格、代码及页码域。
- Tauri 2 macOS 封装配置及原生导出保存对话框。

## 开发

需要 Node.js 22.12+ 和 pnpm 11；桌面构建还需要 Rust 和 Apple 命令行工具。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm gate
pnpm desktop:dev
pnpm desktop:build
```

网页预览默认使用 Vite 输出的地址。桌面开发服务器固定为 `127.0.0.1:1437`。

## Word 输出规则

根节点用于文档名称，其备注为概述；子节点按先序遍历生成章节，备注放在对应标题之后。节点内的小标题采用正文强调，不加入章节目录。导图超过九层时标题样式限制为 Heading 9，完整编号仍保留。当前没有节点输出角色和模板选择器。

目录包含缓存条目，首次打开即可看到章节与链接；准确页码依赖 Word 排版，打开时接受更新域，或在 Word 中更新目录。已在 Mac Word 中验证中文内容、章节层级、表格、图片和目录页码更新；WPS 与 Pages 兼容性仍待验证。

正文图片仅导出已包含的 PNG/JPEG 数据，不访问外网。现有 `.mmst` JSON 兼容保留，备注存储为 Markdown；独立资源包和结构化富文本存储属于后续工作。

## macOS / iOS 状态

macOS 可通过 Tauri 构建本地应用；正式分发的签名、公证与安装体验尚需配置。iOS 共用前端与 Tauri 入口，但需完整 Xcode、签名团队和真机验证；目前没有已验证的 iOS 安装包或移动文件分享实现。

## 来源与许可证

本项目基于 [MindMap Studio](https://github.com/dannbleeker/mindmap-studio)，导入提交为 `2c4749d1f1719ec2158c81cce6e9047a8e0a1e91`。保留 Apache-2.0 的 LICENSE、NOTICE.md 及上游文档。FreeMind 增加离线图文备注、工程 Word 输出与原生封装。

新增组件：Tiptap 开源核心与扩展、docx、Tauri（各自许可证见依赖包）。不依赖 Tiptap 云服务或付费扩展。

上游说明在 [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md)，后续计划见 [docs/ROADMAP.md](docs/ROADMAP.md)。本项目与已有同名 FreeMind Java 项目无隶属关系。
