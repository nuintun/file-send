/**
 * Created by nuintun on 2016/6/24.
 */

'use strict';

var http = require('http');
var FileSend = require('./index');
var colors = require('colors/safe');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

// create server
function createServer(root, port){
  http.createServer(function (request, response){
    var send = new FileSend(request, {
      root: root || './',
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['index.html']
    });

    send.pipe(response).on('headers', function (response, headers){
      console.log('ROOT     :', colors.green.bold(send.root));
      console.log('URL      :', colors.magenta.bold(send.url));
      console.log('PATH     :', colors.yellow.bold(send.path));
      console.log('REALPATH :', colors.yellow.bold(send.realpath));
      console.log('STATUS   :', colors.cyan.bold(send.statusCode));
      console.log('HEADERS  :', colors.cyan.bold(JSON.stringify(headers, null, 2)));
      console.log('--------------------------------------------------------------');
    });
  }).listen(port || 8080, '127.0.0.1');
}

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork().on('listening', (function (i){
      return function (address){
        // Worker is listening
        if (i === numCPUs - 1) {
          console.log(
            colors.green.bold('Server run at port:'),
            colors.cyan.bold(address.port)
          );
        }
      };
    }(i)));
  }
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  createServer();
}
