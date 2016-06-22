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

  var __root, __etag, __ignore, __ignoreAccess, __maxAge, __lastModified;

  // root
  util.defineProperty(this, 'root', {
    enumerable: true,
    get: function (){
      if (!__root) {
        __root = util.isType(options.root, 'string')
          ? path.resolve(options.root)
          : CWD;

        __root = util.posixPath(__root + path.sep);
      }

      return __root;
    }
  });

  // etag
  util.defineProperty(this, 'etag', {
    enumerable: true,
    get: function (){
      if (!__etag) {
        __etag = options.etag !== undefined
          ? Boolean(options.etag)
          : true;
      }

      return __etag;
    }
  });

  // ignore
  util.defineProperty(this, 'ignore', {
    enumerable: true,
    get: function (){
      if (!__ignore) {
        if (this.ignoreAccess !== 'allow') {
          __ignore = Array.isArray(options.ignore)
            ? options.ignore
            : [options.ignore];

          __ignore = __ignore.filter(function (pattern){
            return util.isType(pattern, 'string')
              || util.isType(pattern, 'regexp')
              || util.isType(pattern, 'function');
          });
        } else {
          __ignore = [];
        }
      }

      return __ignore;
    }
  });

  // ignore-access
  util.defineProperty(this, 'ignoreAccess', {
    enumerable: true,
    get: function (){
      if (!__ignoreAccess) {
        switch (options.ignoreAccess) {
          case 'allow':
          case 'deny':
          case 'ignore':
            __ignoreAccess = options.ignoreAccess;
            break;
          default:
            __ignoreAccess = 'deny';
        }
      }

      return __ignoreAccess;
    }
  });

  // max-age
  util.defineProperty(this, 'maxAge', {
    enumerable: true,
    get: function (){
      if (!__maxAge) {
        __maxAge = util.isType(options.maxAge, 'string')
          ? (ms(options.maxAge) || 0) / 1000
          : Number(options.maxAge);

        __maxAge = __maxAge >= 0
          ? Math.min(__maxAge, MAXMAXAGE)
          : MAXMAXAGE;

        __maxAge = Math.floor(__maxAge);
      }

      return __maxAge;
    }
  });

  // last-modified
  util.defineProperty(this, 'lastModified', {
    enumerable: true,
    get: function (){
      if (!__lastModified) {
        __lastModified = options.lastModified !== undefined
          ? Boolean(options.lastModified)
          : true;
      }

      return __lastModified;
    }
  });
}

FileSend.prototype = Object.create(EventEmitter.prototype, { constructor: { value: FileSend } });

http.createServer(function (request, response){
  var send = new FileSend(request, {
    ignore: ['*.js']
  });

  console.log(send.root);
  console.log(send.etag);
  console.log(send.ignore);
  console.log(send.ignoreAccess);
  console.log(send.maxAge);
  console.log(send.lastModified);
  console.log(micromatch.any('a.js', send.ignore));

  response.end('FileSend');
}).listen(9091, '127.0.0.1');
