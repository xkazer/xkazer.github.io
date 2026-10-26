const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 启动服务器
const HTTP_PORT = 80;
const HTTPS_PORT = 443;

// ===== 文件中转配置 =====
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || '';
// 允许上传的扩展名白名单（可执行文件类型不在其中）
const ALLOWED_EXT = new Set([
  'txt', 'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
  'mp4', 'mp3', 'wav', 'flac', 'ogg', 'webm',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'md', 'csv', 'json', 'xml', 'apk', 'ipa', 'br',
]);

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('已创建上传目录: ' + UPLOAD_DIR);
}

// MIME类型
const mimetype = {
  'txt': 'text/plain',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'mp4': 'video/mp4'
};

// 请求处理器
function handleRequest(req, res) {
  console.log(`${new Date().toLocaleString()} [${req.socket.encrypted ? 'HTTPS' : 'HTTP'}] ${req.socket.remoteAddress} ${req.method} ${req.url}`);

  // ===== POST /upload 上传接口 =====
  if (req.method === 'POST' && req.url === '/upload') {
    handleUpload(req, res);
    return;
  }

  // ===== GET /files/:filename 文件下载 =====
  if (req.method === 'GET' && req.url.startsWith('/files/')) {
    handleFileDownload(req, res);
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }
  
  // 解析URL路径
  let urlPath = req.url.split('?')[0];
  
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  
  let realPath;
  try {
    realPath = path.join(__dirname, 'web', decodeURIComponent(urlPath));
  } catch (err) {
    console.log(`URL decode error: ${err.message}`);
    urlPath = '/index.html';
    realPath = path.join(__dirname, 'web', urlPath);
  }
  
  // 防止路径穿越：确保最终路径仍在 web/ 目录内
  const webDir = path.join(__dirname, 'web');
  if (!realPath.startsWith(webDir + path.sep) && realPath !== webDir) {
    page_404(req, res, urlPath);
    return;
  }

  // 检查文件是否存在
  fs.access(realPath, fs.constants.R_OK, (err) => {
    if (err) {
      page_404(req, res, urlPath);
      return;
    }
    
    // 获取文件扩展名
    const ext = path.extname(realPath).toLowerCase().substring(1);
    
    // 设置响应头
    res.writeHead(200, {
      'Content-Type': mimetype[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600'
    });
  
    // 创建文件流
    const fileStream = fs.createReadStream(realPath);
  
    // 处理错误
    fileStream.on('error', (err) => {
      console.error('File read error:', err);
      page_500(req, res, err);
    });
    
    // 管道传输
    fileStream.pipe(res);
  });
}

// ===== 上传处理 =====
function handleUpload(req, res) {
  // Token 鉴权（失败原因只记日志，不返回给客户端）
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!UPLOAD_TOKEN) {
    console.warn(`[upload] 鉴权失败：服务未配置 UPLOAD_TOKEN，来自 ${req.socket.remoteAddress}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  if (!token || token !== UPLOAD_TOKEN) {
    console.warn(`[upload] 鉴权失败：Token 不匹配，来自 ${req.socket.remoteAddress}`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) {
    console.warn(`[upload] 请求格式错误：非 multipart/form-data，来自 ${req.socket.remoteAddress}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Request' }));
    return;
  }
  const boundary = boundaryMatch[1];

  // 收集请求体（限制大小）
  const chunks = [];
  let totalSize = 0;

  req.on('data', (chunk) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE + 4096) { // 多留4KB给表单字段
      console.warn(`[upload] 文件超过大小限制 ${MAX_FILE_SIZE / 1024 / 1024}MB，来自 ${req.socket.remoteAddress}`);
      req.destroy();
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request' }));
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (res.writableEnded) return;
    const body = Buffer.concat(chunks);
    const result = parseMultipart(body, boundary);

    if (!result) {
      console.warn(`[upload] multipart 解析失败，来自 ${req.socket.remoteAddress}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request' }));
      return;
    }

    const { filename, data } = result;
    const ext = path.extname(filename).toLowerCase().substring(1);

    if (!ALLOWED_EXT.has(ext)) {
      console.warn(`[upload] 不允许的文件类型 .${ext}，来自 ${req.socket.remoteAddress}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request' }));
      return;
    }

    // 使用原始文件名保存，同名直接覆盖
    const savePath = path.join(UPLOAD_DIR, filename);

    fs.writeFile(savePath, data, (err) => {
      if (err) {
        console.error(`[upload] 文件保存失败:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
        return;
      }
      const protocol = req.socket.encrypted ? 'https' : 'http';
      const host = req.headers['host'] || 'localhost';
      const downloadUrl = `${protocol}://${host}/files/${encodeURIComponent(filename)}`;
      console.log(`文件上传成功: ${filename} (${data.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        filename: filename,
        size: data.length,
        url: downloadUrl,
      }));
    });
  });

  req.on('error', (err) => {
    console.error('上传请求错误:', err);
  });
}

// ===== multipart/form-data 解析（提取第一个文件字段）=====
function parseMultipart(body, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const CRLF = Buffer.from('\r\n');
  const CRLFCRLF = Buffer.from('\r\n\r\n');

  // 找到第一个 part
  let start = indexOf(body, boundaryBuf, 0);
  if (start === -1) return null;
  start += boundaryBuf.length + CRLF.length; // 跳过 boundary + \r\n

  // 找到 header 结束位置
  const headerEnd = indexOf(body, CRLFCRLF, start);
  if (headerEnd === -1) return null;

  const headerBuf = body.slice(start, headerEnd).toString('utf8');
  const dataStart = headerEnd + CRLFCRLF.length;

  // 找到 part 结束位置（下一个 boundary 前的 \r\n）
  const nextBoundary = Buffer.from('\r\n--' + boundary);
  let dataEnd = indexOf(body, nextBoundary, dataStart);
  if (dataEnd === -1) dataEnd = body.length;

  const data = body.slice(dataStart, dataEnd);

  // 从 Content-Disposition 提取文件名
  const filenameMatch = headerBuf.match(/filename\*?=(?:UTF-8'')?["']?([^"'\r\n;]+)["']?/i);
  if (!filenameMatch) return null;
  let filename = decodeURIComponent(filenameMatch[1].trim());
  // 只保留文件名，去掉路径
  filename = path.basename(filename);

  return { filename, data };
}

// Buffer 中查找子 Buffer 的位置
function indexOf(buf, search, offset) {
  offset = offset || 0;
  for (let i = offset; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

// ===== 文件下载处理 =====
function handleFileDownload(req, res) {
  const urlPath = req.url.split('?')[0];
  let filename;
  try {
    filename = path.basename(decodeURIComponent(urlPath.slice('/files/'.length)));
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // 安全校验：只允许合法文件名（字母、数字、下划线、连字符、点、空格），且扩展名在白名单内
  const ext = path.extname(filename).toLowerCase().substring(1);
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(filename) || !ALLOWED_EXT.has(ext)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  // 防止路径穿越（双重保险）
  if (!filePath.startsWith(UPLOAD_DIR + path.sep) && filePath !== UPLOAD_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filename).toLowerCase().substring(1);
    const contentType = mimetype[ext] || 'application/octet-stream';

    fs.stat(filePath, (err, stat) => {
      if (err) {
        page_500(req, res, err);
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

// 404页面
function page_404(req, res, pathname) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.write('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested URL ' + pathname + ' was not found.</p></body></html>');
  res.end();
}

// 500页面
function page_500(req, res, error) {
  console.error('500 Error:', error);
  res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
  res.write('<!DOCTYPE html><html><head><title>500 Error</title></head><body><h1>500 Internal Server Error</h1></body></html>');
  res.end();
}

// 检查SSL证书
const sslKeyPath = './ssl/key.pem';
const sslCertPath = './ssl/cert.pem';

// 创建HTTP服务器
const httpServer = http.createServer(handleRequest);

// 创建HTTPS服务器
let httpsServer = null;
try {
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };
    
    httpsServer = https.createServer(httpsOptions, handleRequest);
  }
} catch (err) {
  console.warn('HTTPS不可用:', err.message);
  console.log('将以纯HTTP模式运行');
}

// 启动HTTP服务器
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP Server running at http://localhost:${HTTP_PORT}/`);
});

// 启动HTTPS服务器（如果证书存在）
if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server running at https://localhost:${HTTPS_PORT}/`);
  });
} else {
  console.log('HTTPS Server未启动（未找到SSL证书）');
}

console.log('静态文件服务器已启动');
console.log('web目录: ' + path.join(__dirname, 'web'));
console.log('上传目录: ' + UPLOAD_DIR);
console.log('上传功能: ' + (UPLOAD_TOKEN ? '已启用' : '未启用（请设置 UPLOAD_TOKEN 环境变量）'));