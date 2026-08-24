# SuperMarkdown

**免费 · 开源 · 跨平台（Windows / macOS / Linux）的所见即所得 Markdown 编辑器**，追求超越 Typora 的写作体验。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey)

## ✨ 特性

- 🖊️ **真正所见即所得**：基于 ProseMirror 内核，输入 Markdown 语法即时渲染，无源码/预览切换割裂感
- 🗂️ **多标签页**：同时编辑多个文档，标签栏快速切换，未保存状态标记
- 🔍 **全文搜索与替换**：Ctrl+F 搜索面板，实时高亮、逐条跳转、替换当前/全部替换，支持大小写切换
- 🖼️ **图片粘贴**：截图/图片直接粘贴或拖入，自动保存到文档同目录 `assets/` 并以相对路径插入
- 🧮 **数学公式**：行内 `$...$` 与块级 `$$...$$`，KaTeX 渲染，双击可编辑源码
- 📊 **Mermaid 图表**：流程图 / 时序图 / 甘特图等直接内嵌渲染，一键重新渲染
- ⌨️ **代码高亮**：highlight.js 支持数十种语言，暗色代码块 + 语言标签
- ✅ **任务列表**：GFM 语法，点击勾选框直接切换
- 📋 **表格**：Markdown 管道表格所见即所得编辑，Tab / Shift+Tab 单元格导航
- 📁 **文件管理**：打开文件、打开文件夹浏览、最近打开记录、拖拽打开
- 💾 **自动保存**：编辑后自动写入磁盘
- 🧭 **大纲导航**：根据标题自动生成，点击跳转
- 🎨 **主题**：亮色 / 暗色主题一键切换，跟随系统偏好
- 📤 **导出**：一键导出自包含 HTML 与 PDF（公式、图表全部静态内嵌）
- 🗂️ **打包分发**：electron-builder 一键打包 Windows 安装包 / macOS dmg / Linux AppImage+deb

## 🚀 快速开始

```bash
# 安装依赖（国内网络建议使用 npmmirror 镜像）
npm install --registry=https://registry.npmmirror.com
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"   # Windows 用 set ELECTRON_MIRROR=...
npm install   # 再次执行以完成 Electron 二进制下载

# 开发模式（热更新）
npm run dev

# 类型检查 + 构建
npm run build

# 打包（按平台）
npm run dist:win     # Windows NSIS 安装包
npm run dist:mac     # macOS dmg（x64 + arm64）
npm run dist:linux   # Linux AppImage + deb
```

> 提示：`npm run icon` 生成应用图标，`npm run inline-katex` 内联 KaTeX 字体（构建导出 HTML/PDF 必需）。

## 📁 项目结构

```
src/
├── main/            # Electron 主进程（窗口、菜单、文件/导出 IPC）
├── preload/         # 预加载脚本（contextBridge 暴露 api）
└── renderer/        # 渲染进程
    ├── editor/      # ProseMirror 编辑器内核
    │   ├── schema.ts      # 文档模型（含 math / table / task 节点）
    │   ├── parser.ts      # Markdown → 文档（markdown-it + 自定义 token）
    │   ├── serializer.ts  # 文档 → Markdown
    │   ├── nodeviews.ts   # 代码块 / 公式 / 图片节点视图
    │   ├── plugins.ts     # 快捷键 / 输入规则 / 表格导航 / 占位符
    │   └── export.ts      # 自包含 HTML / PDF 导出
    ├── components/   # 标题栏 / 工具栏 / 侧边栏 / 大纲 / 状态栏 / 模态框
    └── store.ts      # zustand 全局状态
```

## 🛣️ 路线图

- [x] 多标签页编辑
- [x] 全文搜索与替换
- [x] 图片粘贴与自动存储
- [ ] 主题商城与自定义主题
- [ ] 插件系统
- [ ] 自动更新（Release 分发）
- [ ] 专注模式 / 打字机模式
- [ ] 导出 Word / LaTeX

## 🤝 参与贡献

欢迎提交 Issue 与 Pull Request！

1. Fork 本仓库并克隆
2. `npm install && npm run dev` 本地开发
3. 提交前请运行 `npm run typecheck` 与 `npm run build`

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源，完全免费，可自由使用、修改与分发。
