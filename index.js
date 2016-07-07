/*!
 * file-send
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
var url = require('url');
var path = require('path');
var http = require('http');
var etag = require('etag');
var fresh = require('fresh');
var destroy = require('destroy');
var mime = require('mime-types');
var util = require('./lib/util');
var async = require('./lib/async');
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
var parseUrl = url.parse;
var listenerCount = EventEmitter.listenerCount;
var originWriteHead = http.ServerResponse.prototype.writeHead;

// add http response write headers events
http.ServerResponse.prototype.writeHead = function (){
  // emit headers event
  if (listenerCount(this, 'headers') > 0) {
    this.emit('headers');
  }

  // call origin method
  originWriteHead.apply(this, arguments);
};

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

  // variable declaration
  var url, path, realpath, root, etag, ignore,
    ignoreAccess, maxAge, lastModified, index;

  // url
  Object.defineProperty(this, 'url', {
    enumerable: true,
    get: function (){
      if (!url) {
        url = util.decodeURI(request.url);
        url = url === -1 ? url : util.normalize(url);
      }

      return url;
    }
  });

  // root
  Object.defineProperty(this, 'root', {
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

  // parsed url
  Object.defineProperty(this, '_url', {
    value: this.url === -1
      ? {}
      : parseUrl(this.url, options.parseQueryString, options.slashesDenoteHost)
  });

  // path
  Object.defineProperty(this, 'path', {
    enumerable: true,
    get: function (){
      if (!path) {
        path = this.url === -1
          ? this.url
          : util.decodeURI(this._url.pathname);
      }

      return path;
    }
  });

  // real path
  Object.defineProperty(this, 'realpath', {
    enumerable: true,
    get: function (){
      if (!realpath) {
        realpath = this.path === -1
          ? this.path
          : util.posixPath(join(this.root, this.path));
      }

      return realpath;
    }
  });

  // query
  Object.defineProperty(this, 'query', {
    enumerable: true,
    value: this._url.query
  });

  // etag
  Object.defineProperty(this, 'etag', {
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
  Object.defineProperty(this, 'ignore', {
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
  Object.defineProperty(this, 'ignoreAccess', {
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
  Object.defineProperty(this, 'maxAge', {
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
  Object.defineProperty(this, 'lastModified', {
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
  Object.defineProperty(this, 'index', {
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
  Object.defineProperty(this, 'stream', {
    value: through(),
    enumerable: false
  });

  // pipe returned stream
  Object.defineProperty(this, '_stream', {
    writable: true,
    enumerable: false,
    value: this.stream
  });

  // headers names
  Object.defineProperty(this, 'headerNames', {
    value: {},
    enumerable: false
  });

  // path has trailing slash
  Object.defineProperty(this, 'hasTrailingSlash', {
    value: this.path === -1 ? false : this.path.slice(-1) === '/'
  });
}

/**
 * extend
 * @type {EventEmitter}
 */
FileSend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: FileSend }
});

/**
 * check if this is a conditional GET request
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isConditionalGET = function (){
  return !!(this.request.headers['if-none-match']
  || this.request.headers['if-modified-since']);
};

/**
 * check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6})
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isCachable = function (){
  var statusCode = this.statusCode;

  return statusCode === 304
    || (statusCode >= 200 && statusCode < 300);
};

/**
 * check if the cache is fresh
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
 * Check if the range is fresh
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
  if (name && util.isType(name, 'string')) {
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

// origin emit method
var emit = FileSend.prototype.emit;

/**
 * emit event
 * @param event
 * @returns {boolean}
 */
FileSend.prototype.emit = function (event){
  // emit event
  if (listenerCount(this, event) > 0) {
    emit.apply(this, [].slice.call(arguments));

    return true;
  } else {
    return false;
  }
};

/**
 * end
 * @param response
 * @param message
 * @api private
 */
FileSend.prototype.end = function (response, message){
  // unpipe
  this._stream.unpipe(response);

  // write message
  message && response.write(message);

  // end response
  response.end();
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
      charset = charset ? '; charset=' + charset : '';

      // set content-type
      this.setHeader('Content-Type', type + charset);
    }
  }

  // set cache-control
  if (cacheControl) {
    this.setHeader('Cache-Control', cacheControl);
  } else {
    cacheControl = this.request.headers['cache-control'];

    if (this.maxAge > 0 && cacheControl !== 'no-cache') {
      this.setHeader('Cache-Control', 'public, max-age=' + this.maxAge);
    }
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
  var size = stats.size;
  var contentLength = size;
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
        this.status(response, 206);

        // multiple ranges
        if (ranges.length > 1) {
          // reset content-length
          contentLength = 0;

          // range boundary
          boundary = util.boundaryGenerator();

          // if user set content-type use user define
          contentType = this.getHeader('Content-Type') || 'application/octet-stream';

          // set multipart/byteranges
          this.setHeader('Content-Type', 'multipart/byteranges; boundary=<' + boundary + '>');

          // create boundary and end boundary
          boundary = '\r\n--<' + boundary + '>';
          endBoundary = boundary + '--\r\n';
          boundary += '\r\nContent-Type: ' + contentType;

          // loop ranges
          ranges.forEach(function (range){
            var _boundary;

            // range start and end
            start = range.start;
            end = range.end;

            // set fields
            _boundary = boundary + '\r\nContent-Range: '
              + 'bytes ' + start + '-' + end
              + '/' + size + '\r\n\r\n';

            // set property
            range.boundary = _boundary;
            // compute content-length
            contentLength += end - start + Buffer.byteLength(_boundary) + 1;

            // cache range
            this.ranges.push(range);
          }, this);

          // the last add end boundary
          this.ranges[this.ranges.length - 1].endBoundary = endBoundary;
          // compute content-length
          contentLength += Buffer.byteLength(endBoundary);
        } else {
          this.ranges.push(ranges[0]);

          start = ranges[0].start;
          end = ranges[0].end;

          // set content-range
          this.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);

          // compute content-length
          contentLength = end - start + 1;
        }
      } else if (ranges === -1) {
        // set content-range
        this.setHeader('Content-Range', 'bytes */' + size);

        // unsatisfiable 416
        this.error(response, 416);

        return false;
      }
    }
  }

  // set content-length
  this.setHeader('Content-Length', contentLength);

  return true;
};

/**
 * set response status
 * @param response
 * @param statusCode
 * @param statusMessage
 * @api private
 */
FileSend.prototype.status = function (response, statusCode, statusMessage){
  this.statusCode = statusCode;
  this.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

  response.statusCode = this.statusCode;
  response.statusMessage = this.statusMessage;
};

/**
 * error
 * @param response
 * @param statusCode
 * @param statusMessage
 * @api private
 */
FileSend.prototype.error = function (response, statusCode, statusMessage){
  this.status(response, statusCode, statusMessage);

  statusCode = this.statusCode;
  statusMessage = this.statusMessage;

  var error = new Error(statusMessage);

  error.statusCode = statusCode;

  // next method
  var next = function (message){
    if (response.headersSent) {
      return this.headersSent(response);
    }

    this.end(response, message);
  }.bind(this);

  // emit if listeners instead of responding
  if (this.emit('error', error, next)) return;

  // set headers
  this.setHeader('Cache-Control', 'private');
  this.setHeader('Content-Type', 'text/html; charset=UTF-8');
  this.setHeader('Content-Length', Buffer.byteLength(statusMessage));
  this.setHeader('X-Content-Type-Options', 'nosniff');

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

  this.error(response, 500, error.message);
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
  // emit event directory
  if (
    this.emit('dir', realpath, stats, function (message){
      if (response.headersSent) {
        return this.headersSent(response);
      }

      this.end(response, message);
    }.bind(this))
  ) return;

  this.error(response, 403);
};

/**
 * redirect
 * @param response
 * @param location
 * @api private
 */
FileSend.prototype.redirect = function (response, location){
  location = location + (this._url.search || '') + (this._url.hash || '');

  var html = escapeHtml(location);

  location = encodeUrl(location);

  var message = 'Redirecting to <a href="' + location + '">' + html + '</a>';

  this.status(response, 301);

  this.setHeader('Cache-Control', 'no-cache');
  this.setHeader('Content-Type', 'text/html; charset=UTF-8');
  this.setHeader('Content-Length', Buffer.byteLength(message));
  this.setHeader('X-Content-Type-Options', 'nosniff');
  this.setHeader('Location', location);

  this.end(response, message);
};

/**
 * headers already sent
 * @param response
 * @api private
 */
FileSend.prototype.headersSent = function (response){
  this.end(response, 'Can\'t set headers after they are sent.');
};

/**
 * write response headers
 * @param response
 * @api private
 */
FileSend.prototype.writeHead = function (response){
  // emit headers event
  this.emit('headers', this.headers);

  // headers
  var headers = this.headers;

  // set headers
  Object.keys(headers).forEach(function (name){
    response.setHeader(name, headers[name]);
  });
};

/**
 * create file stream
 * @param response
 * @api private
 */
FileSend.prototype.createReadStream = function (response){
  var ranges = this.ranges;
  var stream = this.stream;

  // pipe to response
  this._stream.pipe(response);

  // format ranges
  ranges = ranges.length === 0 ? [{}] : ranges;

  // stream error
  var onerror = function (error){
    // request already finished
    if (onFinished.isFinished(response)) return;

    // stat error
    this.statError(response, error);
  }.bind(this);

  // error handling code-smell
  stream.on('error', onerror);

  // contat range
  async.series(ranges, function (range, next){
    // request already finished
    if (onFinished.isFinished(response)) return;

    // create file stream
    var fileStream = fs.createReadStream(this.realpath, range);

    // push boundary
    range.boundary && stream.write(range.boundary);

    // error handling code-smell
    fileStream.on('error', function (error){
      // call onerror
      onerror(error);
      // destroy file stream
      destroy(fileStream);
    });

    // stream end
    fileStream.on('end', function (){
      // unpipe
      fileStream.unpipe(stream);

      // next
      next();

      // destroy file stream
      destroy(fileStream);
    });

    // pipe data to stream
    fileStream.pipe(stream, { end: false });
  }, function (){
    var range = ranges[ranges.length - 1];

    // push end boundary
    range.endBoundary && stream.write(range.endBoundary);

    // end stream
    stream.end();
  }, this);
};

/**
 * redirect to default document
 * @param response
 * @param stats
 * @api private
 */
FileSend.prototype.readIndex = function (response, stats){
  var context = this;
  var path = this.hasTrailingSlash ? this.path : this.path + '/';

  async.series(this.index.map(function (index){
    return path + index;
  }), function (path, next){
    if (context.isIgnore(path)) {
      return next();
    }

    fs.stat(join(context.root, path), function (error, stats){
      if (error || !stats.isFile()) {
        next();
      } else {
        context.redirect(response, util.posixPath(path));
      }
    });
  }, function (){
    if (context.hasTrailingSlash) {
      context.dir(response, context.realpath, stats);
    } else {
      context.redirect(response, context.path + '/');
    }
  });
};

/**
 * read
 * @param response
 * @api private
 */
FileSend.prototype.read = function (response){
  var context = this;

  // headers sent
  if (response.headersSent) {
    return process.nextTick(function (){
      context.headersSent(response);
    });
  }

  // set status
  this.status(response, response.statusCode || 200);

  // path -1 or null byte(s)
  if (this.realpath === -1 || ~this.realpath.indexOf('\0')) {
    return process.nextTick(function (){
      context.error(response, 400);
    });
  }

  // malicious path
  if (util.isOutBound(this.realpath, this.root)) {
    return process.nextTick(function (){
      context.error(response, 403);
    });
  }

  // is ignore path or file
  if (this.isIgnore(this.path)) {
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

    // conditional get support
    if (context.isConditionalGET() && context.isCachable() && context.isFresh()) {
      context.status(response, 304);
      // remove content-type
      context.removeHeader('Content-Type');

      // end with empty content
      return context.end(response);
    }

    // head request
    if (context.request.method === 'HEAD') {
      // set content-length
      context.setHeader('Content-Length', stats.size);

      // end with empty content
      return context.end(response);
    }

    // parse range
    if (context.parseRange(response, stats)) {
      // read file
      context.createReadStream(response);
    }
  });
};

/**
 * pipe
 * @param response
 * @returns {FileSend}
 */
FileSend.prototype.pipe = function (response){
  if (response instanceof http.ServerResponse) {
    // bind error event
    this._stream.on('error', function (error){
      this.statError(response, error);
    }.bind(this));

    // bind headers event
    response.on('headers', function (){
      this.writeHead(response);
    }.bind(this));

    // response finished
    onFinished(response, function (){
      // emit finish event
      this.emit('finish');
    }.bind(this));

    // read
    this.read(response);
  } else {
    this._stream.on('error', function (error){
      response.emit('error', error);
    }.bind(this));

    // pipe
    this._stream = this._stream.pipe(response);
  }

  return this;
};

module.exports = FileSend;
