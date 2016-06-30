/**
 * Created by nuintun on 2016/6/24.
 */

'use strict';

const http = require('http');
const FileSend = require('./index');
const colors = require('colors/safe');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

var first = true;

function createServer(root, port){
  http.createServer(function (request, response){
    var send = new FileSend(request, {
      root: root || './',
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['pets', 'name.txt']
    });

    if (first) {
      first = !first;

      console.log('--------------------------------------------------------------------');
    }

    console.log('ROOT:', colors.red.bold(send.root));
    console.log('URL:', colors.green.bold(send.url));
    console.log('PATH:', colors.yellow.bold(send.path));
    console.log('REALPATH:', colors.cyan.bold(send.realpath));
    console.log('QUERY:', colors.green.bold(JSON.stringify(send.query, null, 2)));

    send
      .pipe(response)
      .on('headers', function (){
        console.log('HEADERS:', colors.magenta.bold(JSON.stringify(send.headers, null, 2)));
        console.log('--------------------------------------------------------------------');
      });
  }).listen(port || 8080, '127.0.0.1', function (){
    console.log(colors.green.bold('Server run at port:'), colors.cyan.bold(port || 8080), '');
  });
}

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  createServer();
  // createServer('./test/fixtures', 9091);
}
