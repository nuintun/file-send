const url = require('url');
const http = require('http');
const FileSend = require('./dist/index');

function createServer(root, port) {
  http.createServer(function(request, response) {
    var send = new FileSend(request, url.parse(request.url).pathname, {
      root: root,
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['index.html']
    });

    send.use(FileSend.through(function(chunk, enc, next) {
      // console.log(chunk + '');

      next(null, chunk);
    }));

    send.pipe(response);
  }).listen(port || 8080, '127.0.0.1');
}

createServer(process.cwd());
