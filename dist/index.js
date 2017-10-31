/**
 * @module file-send
 * @author nuintun
 * @license MIT
 * @version 3.0.0
 * @description A http file send
 * @see https://nuintun.github.io/file-send
 */

'use strict';

var fs = require('fs');
var http = require('http');
var Stream = require('stream');
var Events = require('events');
var mime = require('mime-types');
var etag = require('etag');
var fresh = require('fresh');
var destroy = require('destroy');
var encodeUrl = require('encodeurl');
var micromatch = require('micromatch');
var escapeHtml = require('escape-html');
var onFinished = require('on-finished');
var parseRange = require('range-parser');
var ms = require('ms');
var path = require('path');

/**
 * @module utils
 * @license MIT
 * @version 2017/10/24
 */

const undef = void(0);
const toString = Object.prototype.toString;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * @function typeIs
 * @description The data type judgment
 * @param {any} value
 * @param {string} type
 * @returns {boolean}
 */
function typeIs(value, type) {
  // Format type
  type = (type + '').toLowerCase();

  // Is array
  if (type === 'array') {
    return Array.isArray(value);
  }

  // Get real type
  const realType = toString.call(value).toLowerCase();

  // Switch
  switch (type) {
    case 'nan':
      // Is nan
      return realType === '[object number]' && value !== value;
    default:
      // Is other
      return realType === '[object ' + type + ']';
  }
}

/**
 * @function isOutBound
 * @description Test path is out of bound of base
 * @param {string} path
 * @param {string} root
 * @returns {boolean}
 */
function isOutBound(path$$1, root) {
  if (process.platform === 'win32') {
    path$$1 = path$$1.toLowerCase();
    root = root.toLowerCase();
  }

  if (path$$1.length < root.length) {
    return true;
  }

  return path$$1.indexOf(root) !== 0;
}

/**
 * @function normalize
 * @description Normalize path
 * @param {string} path
 * @returns {string}
 */
function normalize(path$$1) {
  // \a\b\.\c\.\d ==> /a/b/./c/./d
  path$$1 = path$$1.replace(/\\/g, '/');

  // :///a/b/c ==> ://a/b/c
  path$$1 = path$$1.replace(/(:)?\/{2,}/, '$1//');

  // /a/b/./c/./d ==> /a/b/c/d
  path$$1 = path$$1.replace(/\/\.\//g, '/');

  // @author wh1100717
  // a//b/c ==> a/b/c
  // a///b/////c ==> a/b/c
  path$$1 = path$$1.replace(/([^:/])\/+\//g, '$1/');

  // Transfer path
  let src = path$$1;
  // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  const DOUBLE_DOT_RE = /([^/]+)\/\.\.(?:\/|$)/g;

  // a/b/c/../../d ==> a/b/../d ==> a/d
  do {
    src = src.replace(DOUBLE_DOT_RE, (matched, dirname) => {
      return dirname === '..' ? matched : '';
    });

    // Break
    if (path$$1 === src) {
      break;
    } else {
      path$$1 = src;
    }
  } while (true);

  // Get path
  return path$$1;
}

/**
 * @function posixURI
 * @description Format URI to posix style
 * @param {string} path
 * @returns {string}
 */
function posixURI(path$$1) {
  return path$$1.replace(/\\/g, '/');
}

/**
 * @function decodeURI
 * @description Decode URI component.
 * @param {string} uri
 * @returns {string|-1}
 */
function decodeURI(uri) {
  try {
    return decodeURIComponent(uri);
  } catch (err) {
    return -1;
  }
}

/**
 * @function boundaryGenerator
 * @description Create boundary
 * @returns {string}
 */
function boundaryGenerator() {
  let boundary = '';

  // Create boundary
  for (let i = 0; i < 38; i++) {
    boundary += CHARS[Math.floor(Math.random() * 62)];
  }

  // Return boundary
  return boundary;
}

/**
 * @function parseHttpDate
 * @description Parse an HTTP Date into a number.
 * @param {string} date
 * @private
 */
function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);

  return typeIs(timestamp, 'number') ? timestamp : NaN;
}

/**
 * @function Faster apply
 * @description Call is faster than apply, optimize less than 6 args
 * @param  {Function} fn
 * @param  {any} context
 * @param  {Array} args
 * @see https://github.com/micro-js/apply
 * @see http://blog.csdn.net/zhengyinhui100/article/details/7837127
 */


/**
 * @function isUndefined
 * @param {any} value
 */
function isUndefined(value) {
  return value === undef;
}

/**
 * @function pipeline
 * @param {Stream} streams
 * @return {Stream}
 */
function pipeline(streams) {
  let stream;
  const length = streams.length;

  if (length > 1) {
    let index = 0;

    stream = streams[index++];

    while (index < length) {
      stream = stream.pipe(streams[index++]);
    }
  } else {
    stream = streams[0];
  }

  return stream;
}

/**
 * @function parseTokenList
 * @description Parse a HTTP token list.
 * @param {string} value
 */
function parseTokenList(value) {
  let end = 0;
  let list = [];
  let start = 0;

  // gather tokens
  for (let i = 0, length = value.length; i < length; i++) {
    switch (value.charCodeAt(i)) {
      case 0x20:
        /*   */
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        /* , */
        list.push(value.substring(start, end));
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  // final token
  list.push(value.substring(start, end));

  return list;
}

/**
 * @function createErrorDocument
 * @param {number} statusCode
 * @param {string} statusMessage
 * @returns {string}
 */
function createErrorDocument(statusCode, statusMessage) {
  return '<!DOCTYPE html>\n'
    + '<html>\n'
    + '  <head>\n'
    + '    <meta name="renderer" content="webkit" />\n'
    + '    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />\n'
    + '    <meta content="text/html; charset=utf-8" http-equiv="content-type" />\n'
    + `    <title>${ statusCode }</title>\n`
    + '    <style>\n'
    + '      html, body, div, p {\n'
    + '        margin: 0; padding: 0;\n'
    + '        text-align: center;\n'
    + '        font-family: Calibri, "Lucida Console", Consolas, "Liberation Mono", Menlo, Courier, monospace;\n'
    + '      }\n'
    + '      p { color: #0e90d2; line-height: 100%; }\n'
    + '      .ui-code { font-size: 200px; font-weight: bold; margin-top: 66px; }\n'
    + '      .ui-message { font-size: 80px; }\n'
    + '    </style>\n'
    + '  </head>\n'
    + '  <body>\n'
    + `    <p class="ui-code">${ statusCode }</p>\n`
    + `    <p class="ui-message">${ statusMessage }</p>\n`
    + '  </body>\n'
    + '</html>\n';
}

/**
 * @module through
 * @license MIT
 * @version 2017/10/25
 */

/**
 * @class DestroyableTransform
 */
class DestroyableTransform extends Stream.Transform {

  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    super(options);

    this._destroyed = false;
  }

  /**
   * @method destroy
   * @param {any} error
   */
  destroy(error) {
    if (this._destroyed) return;

    this._destroyed = true;

    const self = this;

    process.nextTick(() => {
      if (error) self.emit('error', error);

      self.emit('close');
    });
  }
}

/**
 * @function noop
 * @description A noop _transform function
 * @param {any} chunk
 * @param {string} encoding
 * @param {Function} next
 */
function noop(chunk, encoding, next) {
  next(null, chunk);
}

/**
 * @function throuth
 * @description Create a new export function, contains common logic for dealing with arguments
 * @param {Object} [options]
 * @param {Function} transform
 * @param {Function} [flush]
 * @returns {DestroyableTransform}
 */
function through(options, transform, flush) {
  if (typeIs(options, 'function')) {
    flush = transform;
    transform = options;
    options = {};
  }

  options = options || {};
  options.objectMode = options.objectMode || false;
  options.highWaterMark = options.highWaterMark || 16;

  if (!typeIs(transform, 'function')) transform = noop;
  if (!typeIs(flush, 'function')) flush = null;

  const stream = new DestroyableTransform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;

  return stream;
}

/**
 * @module async
 * @license MIT
 * @version 2017/10/25
 */

/**
 * @class Iterator
 */
class Iterator {
  /**
   * @constructor
   * @param {Array} array
   */
  constructor(array) {
    this.index = 0;
    this.array = Array.isArray(array) ? array : [];
  }

  /**
   * @method next
   * @description Create the next item.
   * @returns {{done: boolean, value: undefined}}
   */
  next() {
    const done = this.index >= this.array.length;
    const value = !done ? this.array[this.index++] : undefined;

    return {
      done: done,
      value: value
    };
  }
}

/**
 * series
 *
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
function series(array, iterator, done) {
  // Create a new iterator
  const it = new Iterator(array);

  // Bind context
  if (arguments.length >= 4) {
    iterator = iterator.bind(context);
    done = done.bind(context);
  }

  /**
   * @function walk
   * @param it
   */
  function walk(it) {
    const item = it.next();

    if (item.done) {
      done();
    } else {
      iterator(item.value, () => {
        walk(it);
      }, it.index);
    }
  }

  // Run walk
  walk(it);
}

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @function normalizeCharset
 * @param {string} charset
 */
function normalizeCharset(charset) {
  return typeIs(charset, 'string') ? charset : null;
}

/**
 * @function normalizeRoot
 * @param {string} root
 */
function normalizeRoot(root) {
  return posixURI(path.join(typeIs(root, 'string') ? path.resolve(root) : CWD));
}

/**
 * @function normalizePath
 * @param {string} path
 */
function normalizePath(path$$1) {
  path$$1 = decodeURI(path$$1);

  return path$$1 === -1 ? path$$1 : normalize(path$$1);
}

/**
 * @function normalizeRealpath
 * @param {string} root
 * @param {string} path
 */
function normalizeRealpath(root, path$$1) {
  return path$$1 === -1 ? path$$1 : posixURI(path.join(root, path$$1));
}

/**
 * @function normalizeList
 * @param {Array} list
 */
function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter((item) => {
    return item && typeIs(item, 'string');
  })
}

/**
 * @function normalizeAccess
 * @param {string} access
 */
function normalizeAccess(access) {
  switch (access) {
    case 'deny':
    case 'ignore':
      return access;
      break;
    default:
      return 'deny';
  }
}

/**
 * @function normalizeMaxAge
 * @param {string|number} maxAge
 */
function normalizeMaxAge(maxAge) {
  maxAge = typeIs(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

/**
 * @function normalizeBoolean
 * @param {boolean} boolean
 * @param {boolean} def
 */
function normalizeBoolean(boolean, def) {
  return isUndefined(boolean) ? def : Boolean(boolean);
}

/**
 * @function normalizeGlob
 * @param {Object} glob
 */
function normalizeGlob(glob) {
  glob = glob || {};
  glob.dot = normalizeBoolean(glob.dot, true);

  return glob;
}

/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

// Headers key symbol
const glob = Symbol('glob');
const headers = Symbol('headers');
const middlewares = Symbol('middlewares');

// File not found status
const NOT_FOUND = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

/**
 * @class FileSend
 */
class FileSend extends Events {
  /**
   * @constructor
   * @param {Request} request
   * @param {String} path
   * @param {Object} options
   */
  constructor(request, path$$1, options) {
    if (!(request instanceof http.IncomingMessage)) {
      throw new TypeError('The param request must be a http request.');
    }

    if (!typeIs(path$$1, 'string')) {
      throw new TypeError('The param path must be a string.');
    }

    super(options);

    this[middlewares] = [];
    this.stdin = through();
    this.request = request;
    this.method = request.method;
    this.path = normalizePath(path$$1);
    this[headers] = Object.create(null);
    this.root = normalizeRoot(options.root);
    this[glob] = normalizeGlob(options.glob);
    this.index = normalizeList(options.index);
    this.ignore = normalizeList(options.ignore);
    this.maxAge = normalizeMaxAge(options.maxAge);
    this.charset = normalizeCharset(options.charset);
    this.etag = normalizeBoolean(options.etag, true);
    this.realpath = normalizeRealpath(this.root, this.path);
    this.ignoreAccess = normalizeAccess(options.ignoreAccess);
    this.immutable = normalizeBoolean(options.immutable, false);
    this.acceptRanges = normalizeBoolean(options.acceptRanges, true);
    this.cacheControl = normalizeBoolean(options.cacheControl, true);
    this.lastModified = normalizeBoolean(options.lastModified, true);
  }

  /**
   * @method use
   * @param {Stream} middleware
   * @public
   */
  use(middleware) {
    if (middleware instanceof Stream) {
      this[middlewares].push(middleware);
    }

    return this;
  }

  /**
   * @method setHeader
   * @param {string} name
   * @param {string} value
   * @public
   */
  setHeader(name, value) {
    // 0 => name
    // 1 => value
    this[headers][name.toLowerCase()] = [name, value];

    return this;
  }

  /**
   * @method getHeader
   * @param {string} name
   * @public
   */
  getHeader(name) {
    return this[headers][name.toLowerCase()][1];
  }

  /**
   * @method getHeaders
   * @public
   */
  getHeaders() {
    const headerItems = this[headers];
    const result = Object.create(null);

    Object
      .keys(headerItems)
      .forEach((name) => {
        let headerItem = headerItems[name];

        result[headerItem[0]] = headerItem[1];
      });

    return result;
  }

  /**
   * @method removeHeader
   * @param {string} name
   * @public
   */
  removeHeader(name) {
    delete this[headers][name.toLowerCase()];

    return this;
  }

  /**
   * @method removeHeaders
   * @public
   */
  removeHeaders() {
    this[headers] = Object.create(null);

    return this;
  }

  /**
   * @method hasListeners
   * @param {string} event
   * @public
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * @method headersSent
   * @private
   */
  headersSent() {
    this.end('Can\'t set headers after they are sent.');
  }

  /**
   * @method status
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  status(statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

    return this;
  }

  /**
   * @method error
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  error(statusCode, statusMessage) {
    const response = this.response;

    this.status(statusCode, statusMessage);

    statusCode = this.statusCode;
    statusMessage = this.statusMessage;

    const error = new Error(statusMessage);

    error.statusCode = statusCode;

    // Emit if listeners instead of responding
    if (this.hasListeners('error')) {
      this.emit('error', error, (chunk) => {
        if (response.headersSent) {
          return this.headersSent();
        }

        this.writeHeaders();
        this.end(chunk);
      });
    } else {
      if (response.headersSent) {
        return this.headersSent();
      }

      // Error document
      const document = createErrorDocument(statusCode, statusMessage);

      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(document));
      this.setHeader('Content-Security-Policy', `default-src 'self' 'unsafe-inline'`);
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this.writeHeaders();
      this.end(document);
    }
  }

  /**
   * @method statError
   * @param {Error} error
   * @private
   */
  statError(error) {
    // 404 error
    if (NOT_FOUND.indexOf(error.code) !== -1) {
      return this.error(404);
    }

    this.error(500, error.message);
  }

  /**
   * @method hasTrailingSlash
   * @private
   */
  hasTrailingSlash() {
    return this.path[this.path.length - 1] === '/';
  }

  /**
   * @method isConditionalGET
   * @private
   */
  isConditionalGET() {
    const headers = this.request.headers;

    return headers['If-Match']
      || headers['If-Unmodified-Since']
      || headers['If-None-Match']
      || headers['If-Modified-Since'];
  }

  /**
   * @method isPreconditionFailure
   * @private
   */
  isPreconditionFailure() {
    const request = this.request;
    const response = this.response;
    // if-match
    const match = request.headers['If-Match'];

    if (match) {
      const etag$$1 = response.getHeader('ETag');

      return !etag$$1 || (match !== '*' && parseTokenList(match).every((match) => {
        return match !== etag$$1 && match !== 'W/' + etag$$1 && 'W/' + match !== etag$$1;
      }));
    }

    // if-unmodified-since
    const unmodifiedSince = parseHttpDate(request.headers['If-Unmodified-Since']);

    if (!isNaN(unmodifiedSince)) {
      const lastModified = parseHttpDate(response.getHeader('Last-Modified'));

      return isNaN(lastModified) || lastModified > unmodifiedSince;
    }

    return false;
  }

  /**
   * @method isCachable
   * @private
   */
  isCachable() {
    const statusCode = this.statusCode;

    return statusCode === 304 || (statusCode >= 200 && statusCode < 300);
  }

  /**
   * @method isFresh
   * @private
   */
  isFresh() {
    return fresh(this.request.headers, {
      'etag': this.getHeader('ETag'),
      'last-modified': this.getHeader('Last-Modified')
    });
  }

  /**
   * @method isRangeFresh
   * @private
   */
  isRangeFresh() {
    const ifRange = this.request.headers['If-Range'];

    if (!ifRange) {
      return true;
    }

    // If-Range as etag
    if (ifRange.indexOf('"') !== -1) {
      const etag$$1 = this.getHeader('ETag');

      return Boolean(etag$$1 && ifRange.indexOf(etag$$1) !== -1);
    }

    // If-Range as modified date
    const lastModified = this.getHeader('Last-Modified');

    return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
  }

  /**
   * @method isIgnore
   * @param {string} path
   * @private
   */
  isIgnore(path$$1) {
    return this.ignore.length && micromatch(path$$1, this.ignore, this[glob]).length;
  }

  /**
   * @method parseRange
   * @param {Stats} stats
   * @private
   */
  parseRange(stats) {
    // Reset ranges
    this.ranges = [];

    // Get size
    const size = stats.size;
    let contentLength = size;

    // Range support
    if (this.acceptRanges) {
      let ranges = this.request.headers['Range'];

      // Range fresh
      if (ranges && this.isRangeFresh()) {
        // Parse range
        ranges = parseRange(size, ranges, { combine: true });

        // Valid ranges, support multiple ranges
        if (Array.isArray(ranges) && ranges.type === 'bytes') {
          this.status(206);

          // Multiple ranges
          if (ranges.length > 1) {
            // Range boundary
            let boundary = `<${ boundaryGenerator() }>`;
            // If user set content-type use user define
            const contentType = this.getHeader('Content-Type') || 'application/octet-stream';

            // Set multipart/byteranges
            this.setHeader('Content-Type', `multipart/byteranges; boundary=${ boundary }`);

            // Create boundary and end boundary
            boundary = `\r\n--${ boundary }`;

            // Closed boundary
            const close = `${ boundary }--\r\n`;

            // Common boundary
            boundary += `\r\nContent-Type: ${ contentType }`;

            // Reset content-length
            contentLength = 0;

            // Map ranges
            ranges.forEach((range) => {
              // Range start and end
              const start = range.start;
              const end = range.end;
              // Set fields
              const open = `${ boundary }\r\nContent-Range: bytes ${ start }-${ end }/${ size }\r\n\r\n`;

              // Set property
              range.open = open;
              // Compute content-length
              contentLength += end - start + Buffer.byteLength(open) + 1;

              // Cache range
              this.ranges.push(range);
            });

            // The first open boundary remove \r\n
            this.ranges[0].open = this.ranges[0].open.replace(/^\r\n/, '');
            // The last add closed boundary
            this.ranges[this.ranges.length - 1].close = close;

            // Compute content-length
            contentLength += Buffer.byteLength(close);
          } else {
            const range = ranges[0];
            const start = range.start;
            const end = range.end;

            // Set content-range
            this.setHeader('Content-Range', `bytes ${ start }-${ end }/${ size }`);

            // Cache range
            this.ranges.push(range);

            // Compute content-length
            contentLength = end - start + 1;
          }
        } else if (ranges === -1) {
          // Set content-range
          this.setHeader('Content-Range', `bytes */${ size }`);
          // Unsatisfiable 416
          this.error(416);

          return false;
        }
      }
    }

    // Set content-length
    this.setHeader('Content-Length', contentLength);

    return true;
  }

  /**
   * @method dir
   * @private
   */
  dir() {
    // If have event directory listener, use user define
    // emit event directory
    if (this.hasListeners('dir')) {
      this.emit('dir', this.realpath, (chunk) => {
        if (this.response.headersSent) {
          return this.headersSent();
        }

        this.writeHeaders();
        this.end(chunk);
      });
    } else {
      this.error(403);
    }
  }

  /**
   * @method redirect
   * @param {string} location
   * @public
   */
  redirect(location) {
    location = encodeUrl(location);

    const href = escapeHtml(location);
    const html = `Redirecting to <a href="${ href }">${ href }</a>`;

    this.status(301);
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(html));
    this.setHeader('Content-Security-Policy', "default-src 'self'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', location);
    this.writeHeaders();
    this.end(html);
  }

  /**
   * @method initHeaders
   * @param {Stats} stats
   * @private
   */
  initHeaders(stats) {
    const response = this.response;

    // Accept-Ranges
    if (this.acceptRanges) {
      // Set Accept-Ranges
      this.setHeader('Accept-Ranges', 'bytes');
    }

    // Content-Type
    if (!(response.getHeader('Content-Type'))) {
      // Get type
      let type = mime.lookup(this.path);

      if (type) {
        let charset = this.charset;

        // Get charset
        charset = charset ? `; charset=${ charset }` : '';

        // Set Content-Type
        this.setHeader('Content-Type', type + charset);
      }
    }

    // Cache-Control
    if (this.cacheControl && this.maxAge > 0 && !(response.getHeader('Cache-Control'))) {
      let cacheControl = `public, max-age=${ this.maxAge }`;

      if (this.immutable) {
        cacheControl += ', immutable';
      }

      // Set Cache-Control
      this.setHeader('Cache-Control', cacheControl);
    }

    // Last-Modified
    if (this.lastModified && !(response.getHeader('Last-Modified'))) {
      // Get mtime utc string
      this.setHeader('Last-Modified', stats.mtime.toUTCString());
    }

    if (this.etag && !(response.getHeader('ETag'))) {
      // Set ETag
      this.setHeader('ETag', etag(stats));
    }
  }

  /**
   * @method writeHeaders
   * @private
   */
  writeHeaders() {
    const response = this.response;
    const headers = this.getHeaders();

    response.statusCode = this.statusCode;
    response.statusMessage = this.statusMessage;

    if (this.hasListeners('headers')) {
      this.emit('headers', headers);
    }

    Object
      .keys(headers)
      .forEach((name) => {
        response.setHeader(name, headers[name]);
      });
  }

  /**
   * @method end
   * @param {string} chunk
   * @public
   */
  end(chunk, encoding, callback) {
    if (chunk) {
      this.stdin.end(chunk, encoding, callback);
    } else {
      this.stdin.end();
    }

    if (this.hasListeners('end')) {
      this.emit('end');
    }
  }

  /**
   * @method sendIndex
   * @private
   */
  sendIndex() {
    const hasTrailingSlash = this.hasTrailingSlash();
    const path$$1 = hasTrailingSlash ? this.path : `${ this.path }/`;

    series(this.index.map((index) => {
      return path$$1 + index;
    }), (path$$1, next) => {
      if (this.isIgnore(path$$1)) {
        return next();
      }

      fs.stat(this.root + path$$1, (error, stats) => {
        if (error || !stats.isFile()) {
          return next();
        }

        this.redirect(posixURI(path$$1));
      });
    }, () => {
      if (hasTrailingSlash) {
        return this.dir();
      }

      this.redirect(path$$1);
    });
  }

  /**
   * @method sendFile
   * @private
   */
  sendFile() {
    // Write headers
    this.writeHeaders();

    const stdin = this.stdin;
    let ranges = this.ranges;
    const response = this.response;

    // Stream error
    const onerror = (error) => {
      // Request already finished
      if (onFinished.isFinished(response)) {
        return stdin.end();
      }

      // Stat error
      this.statError(error);
    };

    // Error handling code-smell
    stdin.on('error', onerror);

    // Format ranges
    ranges = ranges.length ? ranges : [{}];

    // Contat range
    series(ranges, (range, next) => {
      // Request already finished
      if (onFinished.isFinished(response)) {
        return stdin.end();
      }

      // Push open boundary
      range.open && stdin.write(range.open);

      // Create file stream
      const file = fs.createReadStream(this.realpath, range);

      // Error handling code-smell
      file.on('error', (error) => {
        // Call onerror
        onerror(error);
        // Destroy file stream
        destroy(file);
      });

      // File stream end
      file.on('end', () => {
        // Stop pipe stdin
        file.unpipe(stdin);

        // Push close boundary
        range.close && stdin.write(range.close);

        // Destroy file stream
        destroy(file);
      });

      // Next
      file.on('close', next);

      // Pipe stdin
      file.pipe(stdin, { end: false });
    }, () => {
      // End stdin
      this.end();
    });
  }

  /**
   * @method bootstrap
   * @private
   */
  bootstrap() {
    const response = this.response;

    // Set status
    this.status(response.statusCode || 200);

    // Path -1 or null byte(s)
    if (this.path === -1 || this.path.indexOf('\0') !== -1) {
      return this.error(400);
    }

    // Malicious path
    if (isOutBound(this.realpath, this.root)) {
      return this.error(403);
    }

    // Is ignore path or file
    if (this.isIgnore(this.path)) {
      switch (this.ignoreAccess) {
        case 'deny':
          return this.error(403);
        case 'ignore':
          return this.error(404);
      }
    }

    // Read file
    fs.stat(this.realpath, (error, stats) => {
      // Stat error
      if (error) {
        return this.statError(error);
      }

      // Is directory
      if (stats.isDirectory()) {
        return this.sendIndex();
      } else if (this.hasTrailingSlash()) {
        // Not a directory but has trailing slash
        return this.error(404);
      }

      // Set headers and parse range
      this.initHeaders(stats);

      // Conditional get support
      if (this.isConditionalGET()) {
        if (this.isPreconditionFailure()) {
          this.status(412);
        } else if (this.isCachable() && this.isFresh()) {
          this.status(304);
        }

        // Remove content-type
        this.removeHeader('Content-Type');
        this.writeHeaders();

        // End with empty content
        return this.end();
      }

      // Head request
      if (this.method === 'HEAD') {
        // Set content-length
        this.setHeader('Content-Length', stats.size);
        this.writeHeaders();

        // End with empty content
        return this.end();
      }

      // Parse range
      if (this.parseRange(stats)) {
        // Read file
        this.sendFile();
      }
    });
  }

  /**
   * @method pipe
   * @param {Response} response
   * @param {Object} options
   * @public
   */
  pipe(response, options) {
    if (this.response) {
      throw new TypeError('There already have a http response alive.');
    }

    if (!(response instanceof http.ServerResponse)) {
      throw new TypeError('The param response must be a http response.');
    }

    // Set response
    this.response = response;

    // Headers already sent
    if (response.headersSent) {
      this.headersSent();

      return response;
    }

    // Bootstrap
    this.bootstrap();

    // Pipeline
    if (this[middlewares].length) {
      return this.stdin
        .pipe(pipeline(this[middlewares]))
        .pipe(response, options);
    }

    return this.stdin.pipe(response, options);
  }
}

// Exports mime
FileSend.mime = mime;

module.exports = FileSend;
