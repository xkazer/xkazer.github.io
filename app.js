const http = require('http');
const fs = require('fs');
const url = require('url');

var mimetype = {
  'txt': 'text/plain',
  'html': 'text/html',
  'css': 'text/css',
  'xml': 'application/xml',
  'json': 'application/json',
  'js': 'application/javascript',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'png': 'image/png',
  'svg': 'image/svg+xml'
}

var page_404 = function(req, res, path){
    res.writeHead(404, {
      'Content-Type': 'text/html'
    });
    res.write('<!doctype html>\n');
    res.write('<title>404 Not Found</title>\n');
    res.write('<h1>Not Found</h1>');
    res.write(
    '<p>The requested URL ' +
     path + 
    ' was not found on this server.</p>'
    );
    res.end();
}

var page_500 = function(req, res, error){

    res.writeHead(500, {
      'Content-Type': 'text/html'
    });
    res.write('<!doctype html>\n');
    res.write('<title>Internal Server Error</title>\n');
    res.write('<h1>Internal Server Error</h1>');
}


http.createServer(function (req, res) {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // 处理 OAuth 回调
  if (req.method === 'GET' && pathname === '/callback') {
    console.log('Received OAuth callback:', query);

    // 验证必填参数
    if (!query.code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Error: Missing code parameter');
      return;
    }

    // TODO: 在此处用 code 换取 Token（需实现）
    // 示例：向 OAuth 服务端发送 POST 请求
    /*
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        code: query.code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: 'http://xkazer.com/callback',
        grant_type: 'authorization_code'
      })
    });
    */

    // 返回成功响应
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`code: ${query.code} Authorization successful! You can close this page.`);
    return;
  }
  var realPath;
  if (!pathname || pathname === '/') pathname = '/index.html';
  try {
    realPath = __dirname +  "/web" + decodeURI(pathname);
  }catch (err) {
    console.log(`decodeURI: ${pathname} fail: ${err.toString()}`);
    realPath = __dirname +  "/web/index.html";
  }
  fs.access(realPath, fs.constants.R_OK, function(error){
    if(error){
      console.log(new Date().toLocaleString(), req.socket.remoteAddress, req.url, realPath);
      return page_404(req, res, pathname);
    } else {
      var file = fs.createReadStream(realPath);
      res.writeHead(200, {
        'Content-Type': mimetype[realPath.split('.').pop()] || 'text/plain'
      });
      file.on('data', res.write.bind(res));
      file.on('close', res.end.bind(res));	  
      file.on('error', function(err){
        console.log(JSON.stringify(err));
        return page_500(req, res, err);
      });
    }	
  });
}).listen(80, '0.0.0.0');
console.log('Server running at http://localhost/');
