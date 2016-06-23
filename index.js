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
var fresh = require('fresh');
var util = require('./lib/util');
var parseUrl = require('url').parse;
var micromatch = require('micromatch');
var through = require('./lib/through');
var escapeHtml = require('escape-html');
var EventEmitter = require('events').EventEmitter;

// variable declaration
var CWD = process.cwd(); // current working directory
var MAXMAXAGE = 60 * 60 * 24 * 365; // the max max-age set

var listenerCount = EventEmitter.listenerCount
  || function (emitter, type){ return emitter.listeners(type).length; };

function FileSend(request, options){
  if (!(this instanceof FileSend)) {
    return new FileSend(request, options);
  }

  if (!(request instanceof http.IncomingMessage)) {
    throw new TypeError('The first argument must be a http request.');
  }

  this.headers = {};
  this.request = request;
  this.method = this.request.method;

  options = options || {};

  var url, path, root, etag, ignore, ignoreAccess, maxAge, lastModified, stream;

  // url
  util.defineProperty(this, 'url', {
    enumerable: true,
    get: function (){
      if (!url) {
        url = util.decodeURI(request.url);
        url = -1 ? url : util.posixPath(url);
      }

      return url;
    }
  });

  // path
  util.defineProperty(this, 'path', {
    enumerable: true,
    get: function (){
      if (!path) {
        path = this.url === -1
          ? url
          : parseUrl(this.url).pathname;
      }

      return path;
    }
  });

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
    value: through(),
    writable: true,
    enumerable: false
  });

  // stream
  util.defineProperty(this, '_stream', {
    enumerable: false,
    set: function (value){
      stream = value;
    },
    get: function (){
      return stream || this.stream;
    }
  });

  this.views = options.views || {};

  this.status(200);
}

FileSend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: FileSend }
});

/**
 * check if this is a conditional GET request.
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isConditionalGET = function (){
  return this.request.headers['if-none-match']
    || this.request.headers['if-modified-since'];
};

/**
 * check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
 * @param response
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isCachable = function (response){
  var statusCode = response.statusCode;

  return statusCode === 304
    || (statusCode >= 200 && statusCode < 300);
};

/**
 * Check if the cache is fresh.
 * @param response
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isFresh = function (response){
  return fresh(this.request.headers, {
    'etag': response.getHeader('etag'),
    'last-modified': response.getHeader('last-modified')
  });
};

/**
 * Check if the range is fresh.
 * @param response
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isRangeFresh = function (response){
  var ifRange = this.request.headers['if-range'];

  if (!ifRange) {
    return true;
  }

  return ~ifRange.indexOf('"')
    ? ~ifRange.indexOf(response.getHeader('etag'))
    : Date.parse(response.getHeader('last-modified')) <= Date.parse(ifRange);
};

/**
 * set response status
 * @param statusCode
 * @api private
 */
FileSend.prototype.status = function (statusCode){
  this.statusCode = statusCode;
  this.statusMessage = http.STATUS_CODES[statusCode];
};

/**
 * error
 * @api private
 */
FileSend.prototype.error = function (status, message){
  status = status || this.statusCode;
  message = message || this.statusMessage;

  this.statusCode = status;
  this.statusMessage = message;

  var error = new Error(this.statusMessage);

  error.statusCode = this.statusCode;

  // emit if listeners instead of responding
  if (listenerCount(this, 'error') > 0) {
    return this.emit('error', error);
  }

  this.stream.end(this.statusMessage);
};

/**
 * dir
 * @api private
 */
FileSend.prototype.dir = function (){
  // emit if listeners instead of responding
  if (listenerCount(this, 'error') > 0) {
    return this.emit('error', error);
  }

  this.stream.end();
};

FileSend.prototype.redirect = function (){
  this.status(301);

  var location = encodeURI(this.path.slice(-1) === '/' ? this.path : this.path + '/');
  var message = 'Redirecting to <a href="' + location + '">' + location + '</a>';

  this.headers['Content-Type'] = 'text/html; charset=UTF-8';
  this.headers['Content-Length'] = Buffer.byteLength(message);
  this.headers['X-Content-Type-Options'] = 'nosniff';
  this.headers['Location'] = location;

  this.stream.end();
};

FileSend.prototype.read = function (response){
  // path error
  if (this.path === -1) {
    return this.error(400);
  }

  // conditional GET support
  if (this.isConditionalGET() && this.isCachable(response) && this.isFresh(response)) {
    this.status(304);

    return this.stream.end();
  }

  this.stream.end();
};

FileSend.prototype.pipe = function (response){
  if (response instanceof http.OutgoingMessage) {
    this.read(response);
    response.writeHead(this.statusCode, this.statusMessage, this.headers);
  }

  this._stream = this._stream.pipe(response);

  return this;
};

http.createServer(function (request, response){
  var send = new FileSend(request, {
    ignore: ['*.js']
  });

  // console.log('url:', send.url);
  // console.log('path:', send.path);
  // console.log('root:', send.root);
  // console.log('etag:', send.etag);
  // console.log('ignore:', send.ignore);
  // console.log('ignore-access:', send.ignoreAccess);
  // console.log('max-age:', send.maxAge);
  // console.log('last-modified:', send.lastModified);

  send.pipe(response);
}).listen(9091, '127.0.0.1');
