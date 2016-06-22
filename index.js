/*!
 * index
 * Date: 2016/6/21
 * https://github.com/Nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// external lib
var ms = require('ms');
var path = require('path');
var http = require('http');
var util = require('./lib/util');
var micromatch = require('micromatch');
var through = require('./lib/through');
var EventEmitter = require('events').EventEmitter;

// variable declaration
var CWD = process.cwd(); // current working directory
var MAXMAXAGE = 60 * 60 * 24 * 365; // the max max-age set

function FileSend(request, options){
  if (!(this instanceof FileSend)) {
    return new FileSend(request, options);
  }

  if (!(request instanceof http.IncomingMessage)) {
    throw new TypeError('The first argument must be a http request.');
  }

  this.request = request;
  this.stat = null;
  this.headers = {};
  this.statusCode = 200;
  this.method = this.request.method;
  this.statusMessage = http.STATUS_CODES[this.statusCode];

  options = options || {};

  var root, etag, ignore, ignoreAccess, maxAge, lastModified;

  // root
  util.defineProperty(this, 'root', {
    enumerable: true,
    get: function (){
      if (!root) {
        root = util.isType(options.root, 'string')
          ? path.resolve(options.root)
          : CWD;

        root = util.posixPath(root + path.sep);
      }

      return root;
    }
  });

  // etag
  util.defineProperty(this, 'etag', {
    enumerable: true,
    get: function (){
      if (!etag) {
        etag = options.etag !== undefined
          ? Boolean(options.etag)
          : true;
      }

      return etag;
    }
  });

  // ignore
  util.defineProperty(this, 'ignore', {
    enumerable: true,
    get: function (){
      if (!ignore) {
        if (this.ignoreAccess !== 'allow') {
          ignore = Array.isArray(options.ignore)
            ? options.ignore
            : [options.ignore];

          ignore = ignore.filter(function (pattern){
            return util.isType(pattern, 'string')
              || util.isType(pattern, 'regexp')
              || util.isType(pattern, 'function');
          });
        } else {
          ignore = [];
        }
      }

      return ignore;
    }
  });

  // ignore-access
  util.defineProperty(this, 'ignoreAccess', {
    enumerable: true,
    get: function (){
      if (!ignoreAccess) {
        switch (options.ignoreAccess) {
          case 'allow':
          case 'deny':
          case 'ignore':
            ignoreAccess = options.ignoreAccess;
            break;
          default:
            ignoreAccess = 'deny';
        }
      }

      return ignoreAccess;
    }
  });

  // max-age
  util.defineProperty(this, 'maxAge', {
    enumerable: true,
    get: function (){
      if (!maxAge) {
        maxAge = util.isType(options.maxAge, 'string')
          ? (ms(options.maxAge) || 0) / 1000
          : Number(options.maxAge);

        maxAge = maxAge >= 0
          ? Math.min(maxAge, MAXMAXAGE)
          : MAXMAXAGE;

        maxAge = Math.floor(maxAge);
      }

      return maxAge;
    }
  });

  // last-modified
  util.defineProperty(this, 'lastModified', {
    enumerable: true,
    get: function (){
      if (!lastModified) {
        lastModified = options.lastModified !== undefined
          ? Boolean(options.lastModified)
          : true;
      }

      return lastModified;
    }
  });

  // stream
  util.defineProperty(this, 'stream', {
    value: null,
    writable: true,
    enumerable: false
  });

  this.initialize();
}

FileSend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: FileSend }
});

FileSend.prototype.initialize = function (){
  this.stream = through();
  this.stream.push('hello world !');
  this.stream.end();
};

FileSend.prototype.pipe = function (response){
  if (response instanceof http.OutgoingMessage) {
    response.writeHead(this.statusCode, this.statusMessage, this.headers);
  }

  this.stream = this.stream.pipe(response);

  return this;
};

http.createServer(function (request, response){
  var send = new FileSend(request, {
    ignore: ['*.js']
  });

  // console.log(send.root);
  // console.log(send.etag);
  // console.log(send.ignore);
  // console.log(send.ignoreAccess);
  // console.log(send.maxAge);
  // console.log(send.lastModified);
  // console.log(micromatch.any('a.js', send.ignore));

  var stream = through();

  send.pipe(stream).pipe(response);
}).listen(9091, '127.0.0.1');
