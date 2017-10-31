const url = require('url');
const http = require('http');
const FileSend = require('./dist/index');

function createServer(root, port) {
  http.createServer(function(request, response) {
    var send = new FileSend(request, url.parse(request.url).pathname, {
      root: root,
      maxAge: 0,
      ignore: ['/node_modules/**/*'],
      index: ['index.html', 'index.js']
    });

    send.pipe(response);
  }).listen(port || 8080, '127.0.0.1');
}

createServer('F://电影文件');
