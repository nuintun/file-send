/*!
 * index
 * Date: 2016/6/21
 * https://github.com/Nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

var ms = require('ms');
var path = require('path');
var util = require('./lib/util');
var EventEmitter = require('events').EventEmitter;

var cwd = process.cwd(); // current working directory of the process
var MAXMAXAGE = 60 * 60 * 24 * 365; // the max max-age set

function FileSend(request, options){
  this.request = request;

  options = options || {};

  var __root, __etag, __lastModified, __maxAge;

  // root
  util.defineProperty(this, 'root', {
    enumerable: true,
    get: function (){
      if (!__root) {
        __root = util.isType(options.root, 'string')
          ? path.resolve(options.root)
          : cwd;

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

  // max-age
  util.defineProperty(this, 'maxAge', {
    enumerable: true,
    get: function (){
      if (!__root) {
        __maxAge = util.isType(options.maxAge, 'string')
          ? (ms(options.maxAge) || 0) / 1000
          : Number(options.maxAge);

        __maxAge = __maxAge >= 0
          ? Math.min(__maxAge, MAXMAXAGE)
          : 0;

        __maxAge = Math.floor(__maxAge);
      }

      return __maxAge;
    }
  });
}

FileSend.prototype = Object.create(EventEmitter.prototype, { constructor: { value: FileSend } });

var send = new FileSend();

console.log(send);
