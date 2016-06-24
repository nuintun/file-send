/**
 * Created by nuintun on 2016/6/24.
 */

var http = require('http');
var FileSend = require('./index');
var colors = require('colors/safe');

var first = true;

http.createServer(function (request, response){
  var send = new FileSend(request, {
    maxAge: '3day',
    index: ['index.html']
  });

  if (first) {
    first = false;
    console.log('--------------------------------------------------------------------');
  }

  console.log('ROOT:', colors.red.bold(send.root));
  console.log('URL:', colors.green.bold(send.url));
  console.log('PATH:', colors.yellow.bold(send.path));
  console.log('REALPATH:', colors.cyan.bold(send.realpath));
  console.log('QUERY:', colors.green.bold(JSON.stringify(send.query, null, 2)));

  send.pipe(response).on('headers', function (){
    console.log('HEADERS:', colors.magenta.bold(JSON.stringify(send.headers, null, 2)));
    console.log('--------------------------------------------------------------------');
  });
}).listen(8080, '127.0.0.1');
