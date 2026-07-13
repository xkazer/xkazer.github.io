# xkazer.github.io 重构需求文档

> 创建时间：2026-07-13  
> 用途：指导工程重构，明确目标、约束与交付标准

---

## 一、重构目标

在**保持现有使用方式不变**的前提下，对工程进行整理和优化：

1. **代码简洁**：删除冗余代码，统一代码风格，减少重复
2. **视觉统一**：页面风格简约，以**淡蓝色**为主色调，重新梳理 CSS
3. **结构清晰**：源文件与构建产物分离，目录职责明确

---

## 二、约束条件（不可变）

以下内容**不允许改动**，保持现有使用方式：

| 约束项 | 说明 |
|--------|------|
| 启动方式 | `npm start` 启动静态服务器，访问 `http://localhost:8080` |
| 构建方式 | `cd tools && npm run markdown` 构建文章；`npm run links` 构建导航页 |
| 内容格式 | Markdown 文件存放于 `md/` 目录，目录结构不变 |
| 服务器实现 | 保留 `app.js` Node.js 原生静态服务器，不引入新的服务端框架 |
| 构建工具 | 保留 `tools/` 下的 Node.js 脚本，不引入 Vite/Webpack 等打包工具 |
| 页面路由 | 所有现有 URL 路径保持不变（`/index.html`、`/home.html`、`/doc/*.html` 等） |

---

## 三、视觉设计规范

### 3.1 色彩系统

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色（背景/强调） | `#EAF4FB` | 极浅淡蓝，页面背景 |
| 主色（中） | `#5BA4CF` | 中蓝，链接、按钮、标题装饰 |
| 主色（深） | `#2E86C1` | 深蓝，hover 状态、激活态 |
| 辅助色 | `#FFFFFF` | 白色，卡片/内容区背景 |
| 文字主色 | `#2C3E50` | 深灰蓝，正文文字 |
| 文字次色 | `#7F8C8D` | 浅灰，辅助说明文字 |
| 边框色 | `#D6EAF8` | 淡蓝边框 |

### 3.2 设计原则

- **简约**：去除多余装饰，保留必要的间距和留白
- **一致**：所有页面使用统一的导航栏、字体、间距规范
- **轻量**：不引入新的 CSS 框架，在现有 Skeleton 基础上覆盖样式

### 3.3 字体规范

- 正文：系统默认无衬线字体（`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`）
- 代码：等宽字体（`"SFMono-Regular", Consolas, monospace`）
- 不引入外部字体文件

---

## 四、各页面需求

### 4.1 首页（`/index.html`）

**现状**：展示各分类最新文章列表，有背景雨滴动画。

**需求**：
- 保留雨滴动画，但动画颜色改为淡蓝色系（`#5BA4CF`）
- 导航栏：logo 文字 + 关于/笔记/学习/导航 四个链接，简洁横排
- 内容区：文章列表卡片化，白色卡片 + 淡蓝边框，hover 时边框加深
- 页脚：保留 ICP 备案号，字体缩小、居中、灰色

### 4.2 导航页（`/home.html`）

**现状**：分类链接列表 + 搜索框。

**需求**：
- 搜索框居中，输入框简约风格，边框淡蓝色，focus 时边框加深
- 搜索引擎切换下拉框样式统一
- 链接分类以卡片形式展示，每个分类标题淡蓝色背景
- 链接项 hover 时背景变为极浅蓝（`#EAF4FB`）

### 4.3 笔记/文章页（`/doc/*.html`）

**现状**：Markdown 转换的 HTML 内容页。

**需求**：
- 导航栏与首页保持一致
- 内容区最大宽度 `800px`，居中显示
- 代码块：浅灰背景（`#F4F6F8`），左侧淡蓝色竖线装饰
- 标题（h1~h3）下方加淡蓝色下划线装饰
- 链接颜色使用主色蓝（`#5BA4CF`），hover 加深

### 4.4 关于页（`/doc/me.html`）

**需求**：与笔记页样式一致，无特殊要求。

### 4.5 絮嫣页（`/yi/index.html`）

**需求**：该页面为独立风格页面，**不纳入本次重构范围**，保持现状。

---

## 五、代码整理需求

### 5.1 CSS 整理

- **合并重复样式**：导航栏样式目前在 `index.css` 和 `markdown.css` 中各写一份，统一提取到 `common.css`
- **变量化颜色**：在 `common.css` 顶部使用 CSS 变量定义色彩系统，所有颜色引用变量
  ```css
  :root {
    --color-primary-light: #EAF4FB;
    --color-primary:       #5BA4CF;
    --color-primary-dark:  #2E86C1;
    --color-bg:            #FFFFFF;
    --color-text:          #2C3E50;
    --color-text-muted:    #7F8C8D;
    --color-border:        #D6EAF8;
  }
  ```
- **删除无用样式**：清理未被引用的 CSS 规则

### 5.2 HTML 模板整理

- **统一导航栏**：`web/template/markdown.html` 和 `web/template/index.html` 中的导航栏 HTML 保持完全一致
- **语义化标签**：确保使用 `<header>`、`<nav>`、`<main>`、`<footer>` 等语义化标签

### 5.3 JS 整理

- `rain.js`：动画颜色改为淡蓝色系，其余逻辑不变
- `home.js`：逻辑不变，无需修改
- 不引入任何新的 JS 依赖

### 5.4 构建脚本整理

- 修复 `markdown.json` 中的拼写错误：`outoutDir` → `outputDir`（同步更新 `markdown.js` 中的引用）
- 其余构建逻辑不变

---

## 六、交付清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `web/css/common.css` | 修改 | 添加 CSS 变量，提取公共导航栏样式 |
| `web/css/index.css` | 修改 | 使用 CSS 变量，删除与 common.css 重复的样式 |
| `web/css/markdown.css` | 修改 | 使用 CSS 变量，删除与 common.css 重复的样式 |
| `web/css/home.css` | 修改 | 使用 CSS 变量，更新导航页样式 |
| `web/js/rain.js` | 修改 | 动画颜色改为淡蓝色系 |
| `web/template/markdown.html` | 修改 | 导航栏语义化，与 index 模板保持一致 |
| `web/template/index.html` | 修改 | 导航栏语义化 |
| `web/template/home.html` | 修改 | 导航栏语义化 |
| `tools/markdown.json` | 修改 | 修复 `outoutDir` 拼写错误 |
| `tools/markdown.js` | 修改 | 同步更新配置字段引用 |

---

## 七、快速启动（不变）

```bash
# 启动静态文件服务器
npm start
# 访问 http://localhost:8080

# 重新构建 Markdown 文章
cd tools && npm install && npm run markdown

# 重新构建导航页
cd tools && npm run links
```
