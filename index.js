/*!
 * file-send
 * Date: 2016/6/21
 * https://github.com/nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// Import lib
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
var through = require('./lib/through');
var micromatch = require('micromatch');
var onFinished = require('on-finished');
var escapeHtml = require('escape-html');
var parseRange = require('range-parser');
var EventEmitter = require('events').EventEmitter;

// The path sep
var SEP = path.sep;
// Current working directory
var CWD = process.cwd();
// The max max-age set
var MAXMAXAGE = 60 * 60 * 24 * 365;
// File not found status
var NOTFOUND = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

// Common method
var join = path.join;
var resolve = path.resolve;
var parseUrl = url.parse;
var listenerCount = EventEmitter.prototype.listenerCount;
var originWriteHead = http.ServerResponse.prototype.writeHead;

// Hack listener count
listenerCount = util.typeIs(listenerCount, 'function') ? function(emitter, eventName) {
  return emitter.listenerCount(eventName);
} : EventEmitter.listenerCount;

// Add http response write headers events
http.ServerResponse.prototype.writeHead = function() {
  var context = this;

  // Emit headers event
  if (listenerCount(context, 'headers') > 0) {
    context.emit('headers');
  }

  // Call origin method
  util.apply(originWriteHead, context, arguments);
};

/**
 * FileSend
 *
 * @param request
 * @param options
 * @returns {FileSend}
 * @constructor
 */
function FileSend(request, options) {
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
  context.charset = util.typeIs(options.charset, 'string') ? options.charset : null;
  context.glob = options.glob || {};

  if (!context.glob.hasOwnProperty('dot')) {
    context.glob.dot = true;
  }

  // Variable declaration
  var url, path, realpath, root, etag, index,
    ignore, ignoreAccess, maxAge, lastModified;

  // The url
  Object.defineProperty(context, 'url', {
    enumerable: true,
    get: function() {
      if (!url) {
        url = util.decodeURI(request.url);
        url = url === -1 ? url : util.normalize(url);
      }

      return url;
    }
  });

  // The root
  Object.defineProperty(context, 'root', {
    enumerable: true,
    get: function() {
      if (!root) {
        root = util.typeIs(options.root, 'string')
          ? resolve(options.root)
          : CWD;

        root = util.posixURI(join(root, SEP));
      }

      return root;
    }
  });

  // The parsed url
  Object.defineProperty(context, '_url', {
    value: context.url === -1 ? {} : parseUrl(context.url, options.parseQueryString, options.slashesDenoteHost)
  });

  // The path
  Object.defineProperty(context, 'path', {
    enumerable: true,
    get: function() {
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

  // The real path
  Object.defineProperty(context, 'realpath', {
    enumerable: true,
    get: function() {
      if (!realpath) {
        var context = this;

        realpath = context.path === -1
          ? context.path
          : util.posixURI(join(context.root, context.path));
      }

      return realpath;
    }
  });

  // The query
  Object.defineProperty(context, 'query', {
    enumerable: true,
    value: context._url.query
  });

  // The etag
  Object.defineProperty(context, 'etag', {
    enumerable: true,
    get: function() {
      if (!etag) {
        etag = options.etag !== undefined
          ? Boolean(options.etag)
          : true;
      }

      return etag;
    }
  });

  // The index
  Object.defineProperty(context, 'index', {
    enumerable: true,
    get: function() {
      if (!index) {
        index = Array.isArray(options.index) ? options.index : [options.index];

        index = index.filter(function(index) {
          return index && util.typeIs(index, 'string');
        });
      }

      return index;
    }
  });

  // The ignore
  Object.defineProperty(context, 'ignore', {
    enumerable: true,
    get: function() {
      if (!ignore) {
        ignore = Array.isArray(options.ignore) ? options.ignore : [options.ignore];

        ignore = ignore.filter(function(pattern) {
          return pattern && util.typeIs(pattern, 'string');
        });
      }

      return ignore;
    }
  });

  // The ignore-access
  Object.defineProperty(context, 'ignoreAccess', {
    enumerable: true,
    get: function() {
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

  // The max-age
  Object.defineProperty(context, 'maxAge', {
    enumerable: true,
    get: function() {
      if (!maxAge) {
        maxAge = util.typeIs(options.maxAge, 'string')
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

  // The last-modified
  Object.defineProperty(context, 'lastModified', {
    enumerable: true,
    get: function() {
      if (!lastModified) {
        lastModified = options.lastModified !== undefined
          ? Boolean(options.lastModified)
          : true;
      }

      return lastModified;
    }
  });

  // The stream
  Object.defineProperty(context, 'stream', {
    value: through(),
    enumerable: false
  });

  // The pipe returned stream
  Object.defineProperty(context, '_stream', {
    writable: true,
    enumerable: false,
    value: context.stream
  });

  // The headers names
  Object.defineProperty(context, 'headerNames', {
    value: {},
    enumerable: false
  });

  // The path has trailing slash
  Object.defineProperty(context, 'hasTrailingSlash', {
    value: context.path === -1 ? false : context.path.slice(-1) === '/'
  });
}

/**
 * extend
 *
 * @type {EventEmitter}
 */
FileSend.prototype = Object.create(EventEmitter.prototype, {
  constructor: { value: FileSend }
});

/**
 * isConditionalGET
 *
 * @description Check if this is a conditional GET request
 *
 * @return {Boolean}
 * @private
 */
FileSend.prototype.isConditionalGET = function() {
  var context = this;
  var headers = context.request.headers;

  return headers['if-match']
    || headers['if-unmodified-since']
    || headers['if-none-match']
    || headers['if-modified-since'];
};

/**
 * isPreconditionFailure
 *
 * @description Check if the request preconditions failed.
 *
 * @return {boolean}
 * @private
 */
FileSend.prototype.isPreconditionFailure = function() {
  var context = this;
  var request = context.request;
  // if-match
  var match = request.headers['if-match'];

  if (match) {
    var etag = context.getHeader('ETag');

    return !etag || (match !== '*' && match.split(/ *, */).every(function(match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
    }));
  }

  // if-unmodified-since
  var unmodifiedSince = util.parseHttpDate(request.headers['if-unmodified-since']);

  if (!isNaN(unmodifiedSince)) {
    var lastModified = util.parseHttpDate(context.getHeader('Last-Modified'));

    return isNaN(lastModified) || lastModified > unmodifiedSince;
  }

  return false;
}

/**
 * isCachable
 *
 * @description Check if the request is cacheable,
 *   aka responded with 2xx or 304 (see RFC 2616 section 14.2{5,6})
 *
 * @return {Boolean}
 * @private
 */
FileSend.prototype.isCachable = function() {
  var statusCode = this.statusCode;

  return statusCode === 304 || (statusCode >= 200 && statusCode < 300);
};

/**
 * isFresh
 * @description Check if the cache is fresh
 *
 * @return {Boolean}
 * @private
 */
FileSend.prototype.isFresh = function() {
  var context = this;

  return fresh(context.request.headers, {
    'etag': context.getHeader('ETag'),
    'last-modified': context.getHeader('Last-Modified')
  });
};

/**
 * isRangeFresh
 * @description Check if the range is fresh
 *
 * @return {Boolean}
 * @private
 */
FileSend.prototype.isRangeFresh = function() {
  var context = this;
  var ifRange = context.request.headers['if-range'];

  if (!ifRange) {
    return true;
  }

  // if-range as etag
  if (ifRange.indexOf('"') !== -1) {
    var etag = context.getHeader('ETag');

    return Boolean(etag && ifRange.indexOf(etag) !== -1);
  }

  // if-range as modified date
  var lastModified = context.getHeader('Last-Modified');

  return util.parseHttpDate(lastModified) <= util.parseHttpDate(ifRange);
};

/**
 * Is ignore path and files
 *
 * @param path
 * @returns {*|String}
 * @private
 */
FileSend.prototype.isIgnore = function(path) {
  var context = this;

  return context.ignore.length && micromatch(path, context.ignore, context.glob).length;
};

/**
 * Set header
 *
 * @param name
 * @param value
 */
FileSend.prototype.setHeader = function(name, value) {
  var context = this;

  if (name && util.typeIs(name, 'string')) {
    var key = name.toLowerCase();

    if (this.headerNames.hasOwnProperty(key)) {
      delete context.headers[context.headerNames[key]];
    }

    context.headers[name] = value;
    context.headerNames[key] = name;
  }
};

/**
 * Get header
 *
 * @param name
 */
FileSend.prototype.getHeader = function(name) {
  var context = this;

  if (name && util.typeIs(name, 'string')) {
    var key = name.toLowerCase();

    if (context.headerNames.hasOwnProperty(key)) {
      return context.headers[context.headerNames[key]];
    }
  }
};

/**
 * Remove header
 *
 * @param name
 */
FileSend.prototype.removeHeader = function(name) {
  var context = this;

  if (name && util.typeIs(name, 'string')) {
    var key = name.toLowerCase();

    delete context.headers[name];
    delete context.headerNames[key];
  }
};

// Array slice
var slice = Array.prototype.slice;
// Origin emit method
var emit = FileSend.prototype.emit;

/**
 * Emit event
 *
 * @param event
 * @returns {boolean}
 */
FileSend.prototype.emit = function(event) {
  var context = this;

  // Emit event
  if (listenerCount(context, event) > 0) {
    util.apply(emit, context, slice.call(arguments));

    return true;
  } else {
    return false;
  }
};

/**
 * end
 *
 * @param response
 * @param message
 * @private
 */
FileSend.prototype.end = function(response, message) {
  // Unpipe
  this._stream.unpipe(response);

  // Write message
  message && response.write(message);

  // End response
  response.end();
};

/**
 * Set init headers
 *
 * @param response
 * @param stats
 * @private
 */
FileSend.prototype.initHeaders = function(response, stats) {
  var type;
  var context = this;
  var charset = context.charset;
  var eTag = response.getHeader('ETag');
  var contentType = response.getHeader('Content-Type');
  var cacheControl = response.getHeader('Cache-Control');
  var lastModified = response.getHeader('Last-Modified');

  // Set accept-ranges
  context.setHeader('Accept-Ranges', 'bytes');

  // Not override custom set
  if (contentType) {
    context.setHeader('Content-Type', contentType);
  } else {
    // Get type
    type = mime.lookup(context.path);

    if (type) {
      // Get charset
      charset = charset ? '; charset=' + charset : '';

      // Set content-type
      context.setHeader('Content-Type', type + charset);
    }
  }

  // Set cache-control
  if (cacheControl && util.typeIs(cacheControl, 'string')) {
    context.setHeader('Cache-Control', cacheControl);
  } else if (context.maxAge > 0) {
    context.setHeader('Cache-Control', 'max-age=' + context.maxAge);
  }

  // Set last-modified
  if (context.lastModified) {
    if (lastModified) {
      // Get mtime utc string
      context.setHeader('Last-Modified', lastModified);
    } else {
      // Get mtime utc string
      context.setHeader('Last-Modified', stats.mtime.toUTCString());
    }
  }

  // Set etag
  if (context.etag) {
    if (eTag) {
      context.setHeader('ETag', eTag);
    } else {
      context.setHeader('ETag', etag(stats));
    }
  }
};

/**
 * Parse range
 *
 * @param {Object} response
 * @param {Object} stats
 * @private
 */
FileSend.prototype.parseRange = function(response, stats) {
  var context = this;
  var size = stats.size;
  var contentLength = size;
  var ranges = context.request.headers['range'];

  // Reset ranges
  context.ranges = [];

  // Range support
  if (ranges) {
    // Range fresh
    var rangeFresh = context.isRangeFresh();

    // Range fresh
    if (rangeFresh) {
      // Parse range
      ranges = parseRange(size, ranges, { combine: true });

      // Valid ranges, support multiple ranges
      if (util.typeIs(ranges, 'array') && ranges.type === 'bytes') {
        context.status(response, 206);

        // Multiple ranges
        if (ranges.length > 1) {
          // Range boundary
          var boundary = '<' + util.boundaryGenerator() + '>';
          // If user set content-type use user define
          var contentType = context.getHeader('Content-Type') || 'application/octet-stream';

          // Set multipart/byteranges
          context.setHeader('Content-Type', 'multipart/byteranges; boundary=' + boundary);

          // Create boundary and end boundary
          boundary = '\r\n--' + boundary;

          // Closed boundary
          var close = boundary + '--\r\n';

          // Common boundary
          boundary += '\r\nContent-Type: ' + contentType;

          // Reset content-length
          contentLength = 0;

          // Loop ranges
          ranges.forEach(function(range) {
            var open;
            // Range start and end
            var start = range.start;
            var end = range.end;

            // Set fields
            open = boundary + '\r\nContent-Range: ' + 'bytes ' + start + '-' + end + '/' + size + '\r\n\r\n';

            // Set property
            range.open = open;
            // Compute content-length
            contentLength += end - start + Buffer.byteLength(open) + 1;

            // Cache range
            this.ranges.push(range);
          }, context);

          // The last add closed boundary
          context.ranges[context.ranges.length - 1].close = close;
          // Compute content-length
          contentLength += Buffer.byteLength(close);
        } else {
          var range = ranges[0];
          var start = range.start;
          var end = range.end;

          // Set content-range
          context.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);

          // Cache reange
          context.ranges.push(range);

          // Compute content-length
          contentLength = end - start + 1;
        }
      } else if (ranges === -1) {
        // Set content-range
        context.setHeader('Content-Range', 'bytes */' + size);

        // Unsatisfiable 416
        context.error(response, 416);

        return false;
      }
    }
  }

  // Set content-length
  context.setHeader('Content-Length', contentLength);

  return true;
};

/**
 * Set response status
 *
 * @param response
 * @param statusCode
 * @param statusMessage
 * @private
 */
FileSend.prototype.status = function(response, statusCode, statusMessage) {
  var context = this;

  context.statusCode = statusCode;
  context.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

  response.statusCode = context.statusCode;
  response.statusMessage = context.statusMessage;
};

/**
 * error
 *
 * @param response
 * @param statusCode
 * @param statusMessage
 * @private
 */
FileSend.prototype.error = function(response, statusCode, statusMessage) {
  var context = this;

  context.status(response, statusCode, statusMessage);

  statusCode = context.statusCode;
  statusMessage = context.statusMessage;

  var error = new Error(statusMessage);

  error.statusCode = statusCode;

  // Next method
  var next = function(message) {
    var context = this;

    if (response.headersSent) {
      return context.headersSent(response);
    }

    context.end(response, message);
  }.bind(context);

  // Emit if listeners instead of responding
  if (context.emit('error', error, next)) return;

  // Set headers
  context.setHeader('Cache-Control', 'private');
  context.setHeader('Content-Type', 'text/html; charset=UTF-8');
  context.setHeader('Content-Length', Buffer.byteLength(statusMessage));
  context.setHeader('Content-Security-Policy', "default-src 'self'");
  context.setHeader('X-Content-Type-Options', 'nosniff');

  // Next
  next(statusMessage);
};

/**
 * Stat error
 *
 * @param response
 * @param error
 * @private
 */
FileSend.prototype.statError = function(response, error) {
  var context = this;

  // 404 error
  if (NOTFOUND.indexOf(error.code) !== -1) {
    return context.error(response, 404);
  }

  context.error(response, 500, error.message);
};

/**
 * dir
 *
 * @param response
 * @param realpath
 * @param stats
 * @private
 */
FileSend.prototype.dir = function(response, realpath, stats) {
  var context = this;

  // If have event directory listener, use user define
  // emit event directory
  if (
    context.emit('dir', realpath, stats, function(message) {
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
 *
 * @param response
 * @param location
 * @private
 */
FileSend.prototype.redirect = function(response, location) {
  var context = this;

  location = location + (context._url.search || '') + (context._url.hash || '');

  var html = escapeHtml(location);

  location = encodeUrl(location);

  var message = 'Redirecting to <a href="' + location + '">' + html + '</a>';

  context.status(response, 301);

  context.setHeader('Cache-Control', 'no-cache');
  context.setHeader('Content-Type', 'text/html; charset=UTF-8');
  context.setHeader('Content-Length', Buffer.byteLength(message));
  context.setHeader('Content-Security-Policy', "default-src 'self'");
  context.setHeader('X-Content-Type-Options', 'nosniff');
  context.setHeader('Location', location);

  context.end(response, message);
};

/**
 * Headers already sent
 *
 * @param response
 * @private
 */
FileSend.prototype.headersSent = function(response) {
  this.end(response, 'Can\'t set headers after they are sent.');
};

/**
 * Write response headers
 * @param response
 * @private
 */
FileSend.prototype.writeHead = function(response) {
  var context = this;

  // Emit headers event
  context.emit('headers', context.headers);

  // The headers
  var headers = context.headers;

  // Set headers
  Object.keys(headers).forEach(function(name) {
    response.setHeader(name, headers[name]);
  });
};

/**
 * Create file stream
 *
 * @param response
 * @private
 */
FileSend.prototype.createReadStream = function(response) {
  var context = this;
  var ranges = context.ranges;
  var stream = context.stream;

  // Stream error
  var onerror = function(error) {
    // Request already finished
    if (onFinished.isFinished(response)) return;

    // Stat error
    this.statError(response, error);
  }.bind(context);

  // Error handling code-smell
  stream.on('error', onerror);

  // Format ranges
  ranges = ranges.length ? ranges : [{}];

  // Contat range
  async.series(ranges, function(range, next) {
    // Request already finished
    if (onFinished.isFinished(response)) return;

    // Create file stream
    var file = fs.createReadStream(this.realpath, range);

    // Push open boundary
    range.open && stream.write(range.open);

    // Error handling code-smell
    file.on('error', function(error) {
      // Call onerror
      onerror(error);
      // Destroy file stream
      destroy(file);
    });

    // File stream end
    file.on('end', function() {
      // Stop pipe stream
      file.unpipe(stream);

      // Push close boundary
      range.close && stream.write(range.close);

      // Next
      next();
      // Destroy file stream
      destroy(file);
    });

    // Pipe stream
    file.pipe(stream, { end: false });
  }, function() {
    // End stream
    stream.end();
  }, context);

  // Pipe to response
  context._stream.pipe(response);
};

/**
 * Redirect to default document
 *
 * @param response
 * @param stats
 * @private
 */
FileSend.prototype.readIndex = function(response, stats) {
  var context = this;
  var path = context.hasTrailingSlash ? context.path : context.path + '/';

  async.series(context.index.map(function(index) {
    return path + index;
  }), function(path, next) {
    var context = this;

    if (context.isIgnore(path)) {
      return next();
    }

    fs.stat(join(context.root, path), function(error, stats) {
      if (error || !stats.isFile()) {
        next();
      } else {
        this.redirect(response, util.posixURI(path));
      }
    }.bind(context));
  }, function() {
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
 *
 * @param response
 * @private
 */
FileSend.prototype.read = function(response) {
  var context = this;

  // Headers sent
  if (response.headersSent) {
    return process.nextTick(function() {
      this.headersSent(response);
    }.bind(context));
  }

  // Set status
  context.status(response, response.statusCode || 200);

  // Path -1 or null byte(s)
  if (context.realpath === -1 || context.realpath.indexOf('\0') !== -1) {
    return process.nextTick(function() {
      this.error(response, 400);
    }.bind(context));
  }

  // Malicious path
  if (util.isOutBound(context.realpath, context.root)) {
    return process.nextTick(function() {
      this.error(response, 403);
    }.bind(context));
  }

  // Is ignore path or file
  if (context.isIgnore(context.path)) {
    switch (context.ignoreAccess) {
      case 'deny':
        return process.nextTick(function() {
          this.error(response, 403);
        }.bind(context));
      case 'ignore':
        return process.nextTick(function() {
          this.error(response, 404);
        }.bind(context));
    }
  }

  // Read file
  fs.stat(context.realpath, function(error, stats) {
    var context = this;

    // Stat error
    if (error) {
      return context.statError(response, error);
    }

    // Is directory
    if (stats.isDirectory()) {
      return context.readIndex(response, stats);
    } else if (context.hasTrailingSlash) {
      // Not a directory but has trailing slash
      return context.error(response, 404);
    }

    // Set headers and parse range
    context.initHeaders(response, stats);

    // Conditional get support
    if (context.isConditionalGET()) {
      if (context.isPreconditionFailure()) {
        context.status(response, 412);
      } else if (context.isCachable() && context.isFresh()) {
        context.status(response, 304);
      }

      // Remove content-type
      context.removeHeader('Content-Type');

      // End with empty content
      return context.end(response);
    }

    // Head request
    if (context.request.method === 'HEAD') {
      // Set content-length
      context.setHeader('Content-Length', stats.size);

      // End with empty content
      return context.end(response);
    }

    // Parse range
    if (context.parseRange(response, stats)) {
      // Read file
      context.createReadStream(response);
    }
  }.bind(context));
};

/**
 * pipe
 *
 * @param response
 * @returns {FileSend}
 */
FileSend.prototype.pipe = function(response) {
  var context = this;

  if (response instanceof http.ServerResponse) {
    // Bind error event
    context._stream.on('error', function(error) {
      this.statError(response, error);
    }.bind(context));

    // Bind headers event
    response.on('headers', function() {
      this.writeHead(response);
    }.bind(context));

    // Response finished
    onFinished(response, function() {
      // Emit finish event
      this.emit('finish');
    }.bind(context));

    // Read
    context.read(response);
  } else {
    context._stream.on('error', function(error) {
      response.emit('error', error);
    }.bind(context));

    // Pipe
    context._stream = context._stream.pipe(response);
  }

  return context;
};

module.exports = FileSend;
