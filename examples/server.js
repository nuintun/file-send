'use strict';

var http = require('http');
var FileSend = require('../index');
var chalk = require('chalk');
var cluster = require('cluster');
var NUMCPUS = require('os').cpus().length;

// Create server
function createServer(root, port) {
  http.createServer(function(request, response) {
    var send = new FileSend(request, {
      root: root || '../',
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['index.html']
    });

    send.pipe(response).on('headers', function(headers) {
      var message = 'URL      : ' + chalk.green.bold(send.url)
        + '\r\nPATH     : ' + chalk.yellow.bold(send.path)
        + '\r\nROOT     : ' + chalk.magenta.bold(send.root)
        + '\r\nREALPATH : ' + chalk.magenta.bold(send.realpath)
        + '\r\nSTATUS   : ' + chalk.cyan.bold(send.statusCode)
        + '\r\nHEADERS  : ' + chalk.cyan.bold(JSON.stringify(headers, null, 2))
        + '\r\n-----------------------------------------------------------------------------------------';

      process.send(message);
    });
  }).listen(port || 8080, '127.0.0.1');
}

if (cluster.isMaster) {
  // Fork workers
  for (var i = 0; i < NUMCPUS; i++) {
    var worker = cluster.fork().on('listening', (function(i) {
      return function(address) {
        // Worker is listening
        if (i === NUMCPUS - 1) {
          console.log(
            chalk.green.bold('Server run at:'),
            chalk.cyan.bold(address.address + ':' + address.port),
            '\r\n-----------------------------------------------------------------------------------------'
          );
        }
      };
    }(i)));

    worker.on('message', function(message) {
      console.log(message);
    });
  }
} else {
  // Workers can share any tcp connection
  // in this case it is an http server
  createServer();
}
