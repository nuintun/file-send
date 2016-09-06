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
  var context = this;

  // emit headers event
  if (listenerCount(context, 'headers') > 0) {
    context.emit('headers');
  }

  // call origin method
  originWriteHead.apply(context, arguments);
};

/**
 * file send constructor
 * @param request
 * @param options
 * @returns {FileSend}
 * @constructor
 */
function FileSend(request, options){
  var context = this;

  if (!(context instanceof FileSend)) {
    return new FileSend(request, options);
  }

  if (!(request instanceof http.IncomingMessage)) {
    throw new TypeError('The first argument must be a http request.');
  }

  options = options || {};

  context.headers = {};
  context.ranges = [];
  context.request = request;
  context.method = context.request.method;
  context.charset = util.isType(options.charset, 'string')
    ? options.charset
    : null;
  context.glob = options.glob || {};

  if (!context.glob.hasOwnProperty('dot')) {
    context.glob.dot = true;
  }

  // variable declaration
  var url, path, realpath, root, etag, index,
    ignore, ignoreAccess, maxAge, lastModified;

  // url
  Object.defineProperty(context, 'url', {
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
  Object.defineProperty(context, 'root', {
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
  Object.defineProperty(context, '_url', {
    value: context.url === -1
      ? {}
      : parseUrl(context.url, options.parseQueryString, options.slashesDenoteHost)
  });

  // path
  Object.defineProperty(context, 'path', {
    enumerable: true,
    get: function (){
      if (!path) {
        var context = this;

        path = context.url === -1
          ? context.url
          : util.decodeURI(context._url.pathname);

        // //a/b/c ==> /a/b/c
        path = path === -1
          ? path
          : path.replace(/^\/{2,}/, '/');
      }

      return path;
    }
  });

  // real path
  Object.defineProperty(context, 'realpath', {
    enumerable: true,
    get: function (){
      if (!realpath) {
        var context = this;

        realpath = context.path === -1
          ? context.path
          : util.posixPath(join(context.root, context.path));
      }

      return realpath;
    }
  });

  // query
  Object.defineProperty(context, 'query', {
    enumerable: true,
    value: context._url.query
  });

  // etag
  Object.defineProperty(context, 'etag', {
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

  // index
  Object.defineProperty(context, 'index', {
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

  // ignore
  Object.defineProperty(context, 'ignore', {
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
  Object.defineProperty(context, 'ignoreAccess', {
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
  Object.defineProperty(context, 'maxAge', {
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
  Object.defineProperty(context, 'lastModified', {
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
  Object.defineProperty(context, 'stream', {
    value: through(),
    enumerable: false
  });

  // pipe returned stream
  Object.defineProperty(context, '_stream', {
    writable: true,
    enumerable: false,
    value: context.stream
  });

  // headers names
  Object.defineProperty(context, 'headerNames', {
    value: {},
    enumerable: false
  });

  // path has trailing slash
  Object.defineProperty(context, 'hasTrailingSlash', {
    value: context.path === -1 ? false : context.path.slice(-1) === '/'
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
  var context = this;

  return !!(context.request.headers['if-none-match']
  || context.request.headers['if-modified-since']);
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
  var context = this;

  return fresh(context.request.headers, {
    'etag': context.getHeader('ETag'),
    'last-modified': context.getHeader('Last-Modified')
  });
};

/**
 * Check if the range is fresh
 * @return {Boolean}
 * @api private
 */
FileSend.prototype.isRangeFresh = function (){
  var context = this;
  var ifRange = context.request.headers['if-range'];

  if (!ifRange) {
    return true;
  }

  return ifRange.indexOf('"') !== -1
    ? ifRange.indexOf(context.getHeader('ETag')) !== -1
    : Date.parse(context.getHeader('Last-Modified')) <= Date.parse(ifRange);
};

/**
 * is ignore path and files
 * @param path
 * @returns {*|String}
 * @api private
 */
FileSend.prototype.isIgnore = function (path){
  var context = this;

  return context.ignore.length && micromatch(path, context.ignore, context.glob).length;
};

/**
 * set header
 * @param name
 * @param value
 */
FileSend.prototype.setHeader = function (name, value){
  var context = this;

  if (name && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    if (this.headerNames.hasOwnProperty(key)) {
      delete context.headers[context.headerNames[key]];
    }

    context.headers[name] = value;
    context.headerNames[key] = name;
  }
};

/**
 * get header
 * @param name
 */
FileSend.prototype.getHeader = function (name){
  var context = this;

  if (name && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    if (context.headerNames.hasOwnProperty(key)) {
      return context.headers[context.headerNames[key]];
    }
  }
};

/**
 * remove header
 * @param name
 */
FileSend.prototype.removeHeader = function (name){
  var context = this;

  if (name && util.isType(name, 'string')) {
    var key = name.toLowerCase();

    delete context.headers[name];
    delete context.headerNames[key];
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
  var context = this;

  // emit event
  if (listenerCount(context, event) > 0) {
    emit.apply(context, [].slice.call(arguments));

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
  var context = this;
  var charset = context.charset;
  var eTag = response.getHeader('ETag');
  var contentType = response.getHeader('Content-Type');
  var cacheControl = response.getHeader('Cache-Control');
  var lastModified = response.getHeader('Last-Modified');

  // set accept-ranges
  context.setHeader('Accept-Ranges', 'bytes');

  // not override custom set
  if (contentType) {
    context.setHeader('Content-Type', contentType);
  } else {
    // get type
    type = mime.lookup(context.path);

    if (type) {
      // get charset
      charset = charset ? '; charset=' + charset : '';

      // set content-type
      context.setHeader('Content-Type', type + charset);
    }
  }

  // set cache-control
  if (cacheControl !== undefined) {
    context.setHeader('Cache-Control', cacheControl);
  } else {
    cacheControl = context.request.headers['cache-control'];

    var cacheControlObject = util.parseCacheControl(cacheControl);

    if (cacheControlObject !== null) {
      cacheControl = '';

      for (var key in cacheControlObject) {
        if (key !== 'max-age' && cacheControlObject.hasOwnProperty(key)) {
          cacheControl += (cacheControl.length ? ', ' : '')
            + (cacheControlObject[key] === true ? key : key + '=' + cacheControlObject[key]);
        }
      }

      if (cacheControlObject.hasOwnProperty('max-age') && context.maxAge > 0) {
        cacheControl += (cacheControl.length ? ', ' : '') + 'max-age=' + context.maxAge;
      }

      context.setHeader('Cache-Control', cacheControl);
    } else if (context.maxAge > 0) {
      context.setHeader('Cache-Control', 'public, max-age=' + context.maxAge);
    }
  }

  // set last-modified
  if (context.lastModified) {
    if (lastModified) {
      // get mtime utc string
      context.setHeader('Last-Modified', lastModified);
    } else {
      // get mtime utc string
      context.setHeader('Last-Modified', stats.mtime.toUTCString());
    }
  }

  // set etag
  if (context.etag) {
    if (eTag) {
      context.setHeader('ETag', eTag);
    } else {
      context.setHeader('ETag', etag(stats, {
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
  var contentLength = size;
  var boundary, endBoundary;
  var ranges = context.request.headers['range'];

  // Range support
  if (ranges) {
    // Range fresh
    rangeFresh = context.isRangeFresh();

    if (rangeFresh) {
      // parse range
      ranges = parseRange(size, ranges, { combine: true });

      // valid ranges, support multiple ranges
      if (util.isType(ranges, 'array') && ranges.type === 'bytes') {
        context.status(response, 206);

        // multiple ranges
        if (ranges.length > 1) {
          // reset content-length
          contentLength = 0;

          // range boundary
          boundary = util.boundaryGenerator();

          // if user set content-type use user define
          contentType = context.getHeader('Content-Type') || 'application/octet-stream';

          // set multipart/byteranges
          context.setHeader('Content-Type', 'multipart/byteranges; boundary=<' + boundary + '>');

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
          }, context);

          // the last add end boundary
          context.ranges[context.ranges.length - 1].endBoundary = endBoundary;
          // compute content-length
          contentLength += Buffer.byteLength(endBoundary);
        } else {
          context.ranges.push(ranges[0]);

          start = ranges[0].start;
          end = ranges[0].end;

          // set content-range
          context.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);

          // compute content-length
          contentLength = end - start + 1;
        }
      } else if (ranges === -1) {
        // set content-range
        context.setHeader('Content-Range', 'bytes */' + size);

        // unsatisfiable 416
        context.error(response, 416);

        return false;
      }
    }
  }

  // set content-length
  context.setHeader('Content-Length', contentLength);

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
  var context = this;

  context.statusCode = statusCode;
  context.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

  response.statusCode = context.statusCode;
  response.statusMessage = context.statusMessage;
};

/**
 * error
 * @param response
 * @param statusCode
 * @param statusMessage
 * @api private
 */
FileSend.prototype.error = function (response, statusCode, statusMessage){
  var context = this;

  context.status(response, statusCode, statusMessage);

  statusCode = context.statusCode;
  statusMessage = context.statusMessage;

  var error = new Error(statusMessage);

  error.statusCode = statusCode;

  // next method
  var next = function (message){
    var context = this;

    if (response.headersSent) {
      return context.headersSent(response);
    }

    context.end(response, message);
  }.bind(context);

  // emit if listeners instead of responding
  if (context.emit('error', error, next)) return;

  // set headers
  context.setHeader('Cache-Control', 'private');
  context.setHeader('Content-Type', 'text/html; charset=UTF-8');
  context.setHeader('Content-Length', Buffer.byteLength(statusMessage));
  context.setHeader('X-Content-Type-Options', 'nosniff');

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
  var context = this;

  // 404 error
  if (NOTFOUND.indexOf(error.code) !== -1) {
    return context.error(response, 404);
  }

  context.error(response, 500, error.message);
};

/**
 * dir
 * @param response
 * @param realpath
 * @param stats
 * @api private
 */
FileSend.prototype.dir = function (response, realpath, stats){
  var context = this;

  // if have event directory listener, use user define
  // emit event directory
  if (
    context.emit('dir', realpath, stats, function (message){
      var context = this;

      if (response.headersSent) {
        return context.headersSent(response);
      }

      context.end(response, message);
    }.bind(context))
  ) return;

  context.error(response, 403);
};

/**
 * redirect
 * @param response
 * @param location
 * @api private
 */
FileSend.prototype.redirect = function (response, location){
  var context = this;

  location = location + (context._url.search || '') + (context._url.hash || '');

  var html = escapeHtml(location);

  location = encodeUrl(location);

  var message = 'Redirecting to <a href="' + location + '">' + html + '</a>';

  context.status(response, 301);

  context.setHeader('Cache-Control', 'no-cache');
  context.setHeader('Content-Type', 'text/html; charset=UTF-8');
  context.setHeader('Content-Length', Buffer.byteLength(message));
  context.setHeader('X-Content-Type-Options', 'nosniff');
  context.setHeader('Location', location);

  context.end(response, message);
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
  var context = this;

  // emit headers event
  context.emit('headers', context.headers);

  // headers
  var headers = context.headers;

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
  var context = this;
  var ranges = context.ranges;
  var stream = context.stream;

  // pipe to response
  context._stream.pipe(response);

  // format ranges
  ranges = ranges.length === 0 ? [{}] : ranges;

  // stream error
  var onerror = function (error){
    // request already finished
    if (onFinished.isFinished(response)) return;

    // stat error
    this.statError(response, error);
  }.bind(context);

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
  }, context);
};

/**
 * redirect to default document
 * @param response
 * @param stats
 * @api private
 */
FileSend.prototype.readIndex = function (response, stats){
  var context = this;
  var path = context.hasTrailingSlash ? context.path : context.path + '/';

  async.series(context.index.map(function (index){
    return path + index;
  }), function (path, next){
    var context = this;

    if (context.isIgnore(path)) {
      return next();
    }

    fs.stat(join(context.root, path), function (error, stats){
      if (error || !stats.isFile()) {
        next();
      } else {
        this.redirect(response, util.posixPath(path));
      }
    }.bind(context));
  }, function (){
    var context = this;

    if (context.hasTrailingSlash) {
      context.dir(response, context.realpath, stats);
    } else {
      context.redirect(response, path);
    }
  }, context);
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
      this.headersSent(response);
    }.bind(context));
  }

  // set status
  context.status(response, response.statusCode || 200);

  // path -1 or null byte(s)
  if (context.realpath === -1 || context.realpath.indexOf('\0') !== -1) {
    return process.nextTick(function (){
      this.error(response, 400);
    }.bind(context));
  }

  // malicious path
  if (util.isOutBound(context.realpath, context.root)) {
    return process.nextTick(function (){
      this.error(response, 403);
    }.bind(context));
  }

  // is ignore path or file
  if (context.isIgnore(context.path)) {
    switch (context.ignoreAccess) {
      case 'deny':
        return process.nextTick(function (){
          this.error(response, 403);
        }.bind(context));
      case 'ignore':
        return process.nextTick(function (){
          this.error(response, 404);
        }.bind(context));
    }
  }

  // is directory
  if (context.hasTrailingSlash) {
    return fs.stat(context.realpath, function (error, stats){
      var context = this;

      if (error) {
        return context.statError(response, error);
      }

      if (!stats.isDirectory()) {
        return context.error(response, 404);
      }

      context.readIndex(response, stats);
    }.bind(context));
  }

  // other
  fs.stat(context.realpath, function (error, stats){
    var context = this;

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
  }.bind(context));
};

/**
 * pipe
 * @param response
 * @returns {FileSend}
 */
FileSend.prototype.pipe = function (response){
  var context = this;

  if (response instanceof http.ServerResponse) {
    // bind error event
    context._stream.on('error', function (error){
      this.statError(response, error);
    }.bind(context));

    // bind headers event
    response.on('headers', function (){
      this.writeHead(response);
    }.bind(context));

    // response finished
    onFinished(response, function (){
      // emit finish event
      this.emit('finish');
    }.bind(context));

    // read
    context.read(response);
  } else {
    context._stream.on('error', function (error){
      response.emit('error', error);
    }.bind(context));

    // pipe
    context._stream = context._stream.pipe(response);
  }

  return context;
};

module.exports = FileSend;
