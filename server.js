/**
 * Created by nuintun on 2016/6/24.
 */

var http = require('http');
var FileSend = require('./index');
var colors = require('colors/safe');
var zlib = require('zlib');
var through = require('./lib/through');

http.createServer(function (request, response){
  var gzip;
  var send = new FileSend(request, {
    index: ['index.html']
  });

  var acceptEncoding = request.headers['accept-encoding'];

  if (acceptEncoding && acceptEncoding.indexOf('gzip') != -1) {
    gzip = zlib.createGzip();
  } else {
    gzip = through();
  }

  console.log('ROOT:', colors.red.bold(send.root));
  console.log('URL:', colors.green.bold(send.url));
  console.log('PATH:', colors.yellow.bold(send.path));
  console.log('REALPATH:', colors.cyan.bold(send.realpath));

  send.pipe(gzip).pipe(response).on('headers', function (){
    this.removeHeader('Content-Length');
    this.setHeader('Content-Encoding', 'gzip');
    this.setHeader('Transfer-Encoding', 'chunked');

    console.log('HEADERS:', colors.magenta.bold(JSON.stringify(send.headers, null, 2)));
    console.log();
  });
}).listen(8080, '127.0.0.1');
