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

  this.headers = {};
  this.statusCode = 200;
  this.request = request;
  this.method = this.request.method;
  this.statusMessage = http.STATUS_CODES[200];

  options = options || {};

  var url, pathname, root, etag, ignore, ignoreAccess, maxAge, lastModified;

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

  // pathname
  util.defineProperty(this, 'pathname', {
    enumerable: true,
    get: function (){
      if (!pathname) {
        pathname = this.url === -1
          ? ''
          : parseUrl(this.url).pathname;
      }

      return pathname;
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

FileSend.prototype.pipe = function (response){
  if (response instanceof http.OutgoingMessage) {
    // conditional GET support
    if (this.isConditionalGET() && this.isCachable(response) && this.isFresh(response)) {
      this.statusCode = 304;
      this.statusMessage = http.STATUS_CODES[304];
    }

    response.writeHead(this.statusCode, this.statusMessage, this.headers);
  }

  this.stream = this.stream.pipe(response);

  return this;
};

http.createServer(function (request, response){
  var send = new FileSend(request, {
    ignore: ['*.js']
  });

  console.log('url:', send.url);
  console.log('pathname:', send.pathname);
  console.log('root:', send.root);
  console.log('etag:', send.etag);
  console.log('ignore:', send.ignore);
  console.log('ignore-access:', send.ignoreAccess);
  console.log('max-age:', send.maxAge);
  console.log('last-modified:', send.lastModified);

  var stream = through();

  send.pipe(stream).pipe(response);
}).listen(9091, '127.0.0.1');
