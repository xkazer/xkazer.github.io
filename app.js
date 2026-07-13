const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 启动服务器
const HTTP_PORT = 80;
const HTTPS_PORT = 443;


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
  res.write('<!DOCTYPE html><html><head><title>500 Error</title></head><body><h1>500 Internal Server Error</h1><p>' + error.message + '</p></body></html>');
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