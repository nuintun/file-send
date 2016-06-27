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
var fs = require('fs');
var path = require('path');
var http = require('http');
var etag = require('etag');
var fresh = require('fresh');
var destroy = require('destroy');
var mime = require('mime-types');
var util = require('./lib/util');
var async = require('./lib/async');
var parseUrl = require('url').parse;
var encodeUrl = require('encodeurl');
var micromatch = require('micromatch');
var through = require('./lib/through');
var onFinished = require('on-finished');
var escapeHtml = require('escape-html');
var parseRange = require('range-parser');
var EventEmitter = require('events').EventEmitter;

// variable declaration
var SEP = path.sep;
var CWD = process.cwd(); // current working directory
var MAXMAXAGE = 60 * 60 * 24 * 365; // the max max-age set
var NOTFOUND = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

// common method
var join = path.join;
var resolve = path.resolve;
var listenerCount = EventEmitter.listenerCount
  || function (emitter, type){ return emitter.listeners(type).length; };

/**
 * file send constructor
 * @param request
 * @param options
 * @returns {FileSend}
 * @constructor
 */
function FileSend(request, options){
  if (!(this instanceof FileSend)) {
    return new FileSend(request, options);
  }

  if (!(request instanceof http.IncomingMessage)) {
    throw new TypeError('The first argument must be a http request.');
  }

  options = options || {};

  this.headers = {};
  this.ranges = [];
  this.request = request;
  this.method = this.request.method;
  this.charset = util.isType(options.charset, 'string')
    ? options.charset
    : null;
  this.glob = options.glob || {};

  if (!this.glob.hasOwnProperty('dot')) {
    this.glob.dot = true;
  }

  var url, path, realpath, root, etag, ignore,
    ignoreAccess, maxAge, lastModified, index, stream;

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

  // root
  util.defineProperty(this, 'root', {
    enumerable: true,
    get: function (){
      if (!root) {
        root = util.isType(options.root, 'string')
          ? resolve(options.root)
          : CWD;

        root = util.posixPath(join(root, SEP));
      }

      return root;
    }
  });

  var parsedUrl = parseUrl(this.url, true);

  // path
  util.defineProperty(this, 'path', {
    enumerable: true,
    get: function (){
      if (!path) {
        path = this.url === -1
          ? url
          : parsedUrl.pathname;
      }

      return path;
    }
  });

  // query
  util.defineProperty(this, 'query', {
    enumerable: true,
    value: parsedUrl.query
  });

  util.defineProperty(this, 'realpath', {
    enumerable: true,
    get: function (){
      if (!realpath) {
        realpath = util.posixPath(join(this.root, this.path));
      }

      return realpath;
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
        ignore = Array.isArray(options.ignore)
          ? options.ignore
          : [options.ignore];

        ignore = ignore.filter(function (pattern){
          return pattern
            && (util.isType(pattern, 'string')
            || util.isType(pattern, 'regexp')
            || util.isType(pattern, 'function'));
        });
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
          ? ms(options.maxAge) / 1000
          : Number(options.maxAge);

        maxAge = !isNaN(maxAge)
          ? Math.min(Math.max(0, maxAge), MAXMAXAGE)
          : 0;

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

  // last-modified
  util.defineProperty(this, 'index', {
    enumerable: true,
    get: function (){
      if (!index) {
        index = Array.isArray(options.index)
          ? options.index
          : [options.index];

        index = index.filter(function (index){
          return index && util.isType(index, 'string');
        });
      }

      return index;
    }
  });

  // stream
  util.defineProperty(this, 'stream', {
    value: through(),
    writable: true,
    enumerable: false
  });

  // pipe returned stream
  util.defineProperty(this, '_stream', {
    enumerable: false,
    set: function (value){
      stream = value;
    },
    get: function (){
      return stream || this.stream;
    }
  });

  // headers names
  util.defineProperty(this, 'headerNames', {
    value: {},
    writable: true,
    enumerable: false
  });

  // path has trailing slash
  util.defineProperty(this, 'hasTrailingSlash', {
    value: this.path.slice(-1) === '/'
  });

  this.status(200);
}

/**
 * extend
 * @type {EventEmitter}
 */
FileSend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: FileSend }
});

/**
 * check if this is a conditional GET request.
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isConditionalGET = function (){
  return !!(this.request.headers['if-none-match']
  || this.request.headers['if-modified-since']);
};

/**
 * check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isCachable = function (){
  var statusCode = this.statusCode;

  return statusCode === 304
    || (statusCode >= 200 && statusCode < 300);
};

/**
 * check if the cache is fresh.
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isFresh = function (){
  return fresh(this.request.headers, {
    'etag': this.getHeader('ETag'),
    'last-modified': this.getHeader('Last-Modified')
  });
};

/**
 * Check if the range is fresh.
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isRangeFresh = function (){
  var ifRange = this.request.headers['if-range'];

  if (!ifRange) {
    return true;
  }

  return ~ifRange.indexOf('"')
    ? ~ifRange.indexOf(this.getHeader('ETag'))
    : Date.parse(this.getHeader('Last-Modified')) <= Date.parse(ifRange);
};

/**
 * is ignore path and files
 * @param path
 * @returns {*|String}
 * @api private
 */
FileSend.prototype.isIgnore = function (path){
  return this.ignore.length && micromatch.any(path, this.ignore, this.glob);
};

/**
 * set header
 * @param name
 * @param value
 */
FileSend.prototype.setHeader = function (name, value){
  if (name && value && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    if (this.headerNames.hasOwnProperty(key)) {
      delete this.headers[this.headerNames[key]];
    }

    this.headers[name] = value;
    this.headerNames[key] = name;
  }
};

/**
 * get header
 * @param name
 */
FileSend.prototype.getHeader = function (name){
  if (name && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    if (this.headerNames.hasOwnProperty(key)) {
      return this.headers[this.headerNames[key]];
    }
  }
};

/**
 * remove header
 * @param name
 */
FileSend.prototype.removeHeader = function (name){
  if (name && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    delete this.headers[name];
    delete this.headerNames[key];
  }
};

/**
 * set headers
 * @param response
 * @param stats
 * @api private
 */
FileSend.prototype.setHeaders = function (response, stats){
  var type;
  var charset = this.charset;
  var eTag = response.getHeader('ETag');
  var contentType = response.getHeader('Content-Type');
  var cacheControl = response.getHeader('Cache-Control');
  var lastModified = response.getHeader('Last-Modified');

  // set accept-ranges
  this.setHeader('Accept-Ranges', 'bytes');

  // not override custom set
  if (contentType) {
    this.setHeader('Content-Type', contentType);
  } else {
    // get type
    type = mime.lookup(this.path);

    if (type) {
      // get charset
      charset = charset && mime.charset(type) ? charset : null;

      // set content-type
      this.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
    }
  }

  // set cache-control
  if (cacheControl) {
    this.setHeader('Cache-Control', cacheControl);
  } else {
    cacheControl = this.request.headers['cache-control'];

    var canCache = this.maxAge > 0 && cacheControl !== 'no-cache';

    cacheControl = !canCache && this.maxAge > 0 ? 'no-cache' : 'private';

    this.setHeader('Cache-Control', canCache ? 'public, max-age=' + this.maxAge : cacheControl);
  }

  // set last-modified
  if (this.lastModified) {
    if (lastModified) {
      // get mtime utc string
      this.setHeader('Last-Modified', lastModified);
    } else {
      // get mtime utc string
      this.setHeader('Last-Modified', stats.mtime.toUTCString());
    }
  }

  // set etag
  if (this.etag) {
    if (eTag) {
      this.setHeader('ETag', eTag);
    } else {
      this.setHeader('ETag', etag(stats, {
        weak: false // disable weak etag
      }));
    }
  }
};

/**
 * parse range
 * @param {Object} response
 * @param {Object} stats
 * @api private
 */
FileSend.prototype.parseRange = function (response, stats){
  var start, end;
  var rangeFresh;
  var contentType;
  var context = this;
  var size = stats.size;
  var boundary, endBoundary;
  var ranges = this.request.headers['range'];

  // Range support
  if (ranges) {
    // Range fresh
    rangeFresh = this.isRangeFresh();

    if (rangeFresh) {
      // parse range
      ranges = parseRange(size, ranges, { combine: true });

      // valid ranges, support multiple ranges
      if (util.isType(ranges, 'array') && ranges.type === 'bytes') {
        this.status(206);

        // multiple ranges
        if (ranges.length > 1) {
          // reset content length
          size = 0;
          // range boundary
          boundary = util.boundaryGenerator();

          // if user set content-type use user define
          contentType = this.getHeader('Content-Type') || 'application/octet-stream';

          // set multipart/byteranges
          this.setHeader('Content-Type', 'multipart/byteranges; boundary=<' + boundary + '>');

          // create boundary and end boundary
          boundary = '--<' + boundary + '>';
          endBoundary = '\r\n' + boundary + '--';
          boundary += '\r\nContent-Type: ' + contentType;

          // loop ranges
          ranges.forEach(function (range, i){
            var _boundary;

            // range start and end
            start = range.start;
            end = range.end;

            // set fields
            _boundary = (i == 0 ? '' : '\r\n') + boundary
              + '\r\nContent-Range: ' + 'bytes ' + start
              + '-' + end + '/' + stats.size + '\r\n\r\n';

            // set property
            range.boundary = _boundary;
            size += end - start + Buffer.byteLength(_boundary) + 1;

            // cache range
            context.ranges.push(range);
          });

          // the last add end boundary
          this.ranges[context.ranges.length - 1].endBoundary = endBoundary;
          size += Buffer.byteLength(endBoundary);
        } else {
          this.ranges.push(ranges[0]);

          start = ranges[0].start;
          end = ranges[0].end;

          // set content-range
          this.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);

          // reset content length
          size = end - start + 1;
        }
      } else if (ranges === -1) {
        // set content-range
        this.setHeader('Content-Range', 'bytes */' + size);

        // unsatisfiable 416
        return this.error(response, 416);
      }
    }
  }

  // set content-length
  this.setHeader('Content-Length', size);
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
 * @param response
 * @param statusCode
 * @param statusMessage
 * @api private
 */
FileSend.prototype.error = function (response, statusCode, statusMessage){
  switch (arguments.length) {
    case 2:
      this.status(statusCode);
      break;
    case 3:
      this.statusCode = statusCode;
      this.statusMessage = statusMessage;
      break;
  }

  statusCode = this.statusCode;
  statusMessage = this.statusMessage;

  var error = new Error(statusMessage);

  error.statusCode = statusCode;

  // next method
  var next = function (message){
    this.writeHead(response);
    this.stream.end(message);
  }.bind(this);

  // emit if listeners instead of responding
  if (listenerCount(this, 'error') > 0) {
    return this.emit('error', response, error, next);
  }

  // set headers
  this.setHeader('Cache-Control', 'private');
  this.setHeader('Content-Type', 'text/html; charset=UTF-8');
  this.setHeader('Content-Length', Buffer.byteLength(statusMessage));

  // next
  next(statusMessage);
};

/**
 * stat error
 * @param response
 * @param error
 * @api private
 */
FileSend.prototype.statError = function (response, error){
  // 404 error
  if (~NOTFOUND.indexOf(error.code)) {
    return this.error(response, 404);
  }

  this.error(response, 500);
};

/**
 * dir
 * @param response
 * @param realpath
 * @param stats
 * @api private
 */
FileSend.prototype.dir = function (response, realpath, stats){
  // if have event directory listener, use user define
  if (listenerCount(this, 'dir') > 0) {
    // emit event directory
    return this.emit('dir', response, realpath, stats, function (message){
      this.writeHead(response);
      this.stream.end(message);
    }.bind(this));
  }

  this.error(response, 403);
};

/**
 * redirect
 * @param response
 * @param location
 * @api private
 */
FileSend.prototype.redirect = function (response, location){
  var html = escapeHtml(location);

  location = encodeUrl(location);

  var message = 'Redirecting to <a href="' + location + '">' + html + '</a>';

  this.status(301);

  this.setHeader('Cache-Control', 'no-cache');
  this.setHeader('Content-Type', 'text/html; charset=UTF-8');
  this.setHeader('Content-Length', Buffer.byteLength(message));
  this.setHeader('X-Content-Type-Options', 'nosniff');
  this.setHeader('Location', location);

  this.writeHead(response);
  this.stream.end(message);
};

/**
 * write response headers
 * @param response
 * @api private
 */
FileSend.prototype.writeHead = function (response){
  if (!response.headersSent) {
    if (listenerCount(this, 'headers') > 0) {
      this.emit('headers', response, this.headers);
    }

    response.writeHead(this.statusCode, this.statusMessage, this.headers);
  }
};

/**
 * create file stream
 * @param response
 * @api private
 */
FileSend.prototype.createReadStream = function (response){
  var context = this;
  var isFinished = false;
  var ranges = this.ranges;
  var stream = this.stream;

  // stream error
  function onerror(error){
    // request already finished
    if (isFinished) return;

    // destroy stream
    destroy(stream);

    // stat error
    context.statError(response, error);
  }

  // contat range
  function concatRange(){
    // request already finished
    if (isFinished) return;

    var range = ranges.shift() || {};
    var lenRanges = ranges.length;
    var fileStream = fs.createReadStream(context.realpath, range);

    // push boundary
    range.boundary && stream.push(range.boundary);

    // error handling code-smell
    fileStream.on('error', function (error){
      // call onerror
      onerror(error);
      // destroy file stream
      destroy(fileStream);
    });

    // stream end
    fileStream.on('end', function (){
      if (lenRanges > 0) {
        // recurse ranges
        concatRange();
      } else {
        // push end boundary
        range.endBoundary && stream.push(range.endBoundary);

        // end stream
        stream.end();
      }

      // destroy file stream
      destroy(fileStream);
    });

    // pipe data to stream
    fileStream.pipe(stream, { end: false });
  }

  // error handling code-smell
  stream.on('error', onerror);

  // response finished, done with the fd
  onFinished(response, function (){
    isFinished = true;

    // destroy stream
    destroy(stream);
  });

  // concat range
  concatRange();
};

/**
 * redirect to default document
 * @param response
 * @param stats
 * @api private
 */
FileSend.prototype.readIndex = function (response, stats){
  var context = this;
  var path = this.hasTrailingSlash ? context.path : context.path + '/';

  async.series(this.index.map(function (index){
    return path + index;
  }), function (path, next){
    if (context.isIgnore(path)) {
      return next();
    }

    fs.stat(join(context.root, path), function (error){
      if (error) {
        next();
      } else {
        context.redirect(response, util.posixPath(path));
      }
    });
  }, function (){
    context.dir(response, context.realpath, stats);
  });
};

/**
 * read
 * @param response
 * @api private
 */
FileSend.prototype.read = function (response){
  var context = this;

  // path error
  if (this.path === -1) {
    return process.nextTick(function (){
      context.error(response, 400);
    });
  }

  // is ignore path or file
  if (context.isIgnore(this.path)) {
    switch (this.ignoreAccess) {
      case 'deny':
        return process.nextTick(function (){
          context.error(response, 403);
        });
      case 'ignore':
        return process.nextTick(function (){
          context.error(response, 404);
        });
    }
  }

  // is directory
  if (this.hasTrailingSlash) {
    return fs.stat(this.realpath, function (error, stats){
      if (error) {
        return context.statError(response, error);
      }

      if (!stats.isDirectory()) {
        return context.error(response, 404);
      }

      context.readIndex(response, stats);
    });
  }

  // other
  fs.stat(this.realpath, function (error, stats){
    // stat error
    if (error) {
      return context.statError(response, error);
    }

    // is directory
    if (stats.isDirectory()) {
      return context.readIndex(response, stats);
    }

    // set headers and parse range
    context.setHeaders(response, stats);
    context.parseRange(response, stats);

    // conditional get support
    if (context.isConditionalGET() && context.isCachable() && context.isFresh()) {
      context.status(304);
      context.writeHead(response);

      return context.stream.end();
    }

    // write head and read file
    context.writeHead(response);
    context.createReadStream(response);
  });
};

/**
 * pipe
 * @param response
 * @returns {FileSend}
 */
FileSend.prototype.pipe = function (response){
  if (response instanceof http.OutgoingMessage) {
    this.read(response);
  }

  this._stream = this._stream.pipe(response);

  return this;
};

module.exports = FileSend;
