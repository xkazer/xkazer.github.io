## 个人主页

[进入主页](https://xkazer.github.io)

## 环境说明

### 运行环境

- **Web 服务器**：Node.js 原生模块实现（`app.js`），无第三方依赖。
  - 启动：`npm start`，默认监听 HTTP 80 端口，可用环境变量 `PORT` / `HTTPS_PORT` 覆盖，例如 `PORT=8080 npm start`。
  - 存在 `ssl/key.pem` 和 `ssl/cert.pem` 时同时启用 HTTPS。
- **前端页面**（`web/`）：纯静态 HTML/CSS/JS，所有工具在浏览器本地运行，不加载外部库，也不上传用户数据。
- **Markdown 生成工具**（`tools/`）：依赖 `markdown-it`，使用前先执行 `cd tools && npm install`。

### 开发期验证依赖（可选，不属于本工程）

开发二维码生成工具（`web/js/qrcode.js`）时，为验证生成结果能被正确解码，临时使用了 Python 库 `opencv-python-headless`：

- **性质**：本地库，不是线上加载。通过 `pip install opencv-python-headless` 从 PyPI 下载一次，安装在本机 Python 环境的 `site-packages` 下（依赖 `numpy` 一并安装），之后离线可用。
- **用途**：仅在本机用临时 Python 脚本调用 `cv2.QRCodeDetector` 解码二维码做对照，脚本用完即删。
- **与工程的关系**：不在项目目录内，`package.json` 也不记录；网页运行和部署都不需要它，不装也不影响任何功能。
- **卸载**：`pip uninstall opencv-python-headless`。`numpy` 若还被其他项目使用则保留，否则一并卸载。
