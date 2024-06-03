var http = require('http');
var fs = require('fs');

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
  let name = req.url.match(/[0-9a-zA-Z.\/]+/)?.input;
  var realPath;
  if (!name || name === '/') name = '/index.html';
  try {
    realPath = __dirname +  "/web" + decodeURI(name);
  }catch (err) {
    console.log(`decodeURI: ${name} fail: ${err.toString()}`);
    realPath = __dirname +  "/web/index.html";
  }
  fs.access(realPath, fs.constants.R_OK, function(error){
    if(error){
      console.log(new Date().toLocaleString(), req.socket.remoteAddress, req.url, realPath);
      return page_404(req, res, name);
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
