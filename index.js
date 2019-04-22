/**
 * @module file-send
 * @author nuintun
 * @license MIT
 * @version 4.0.0
 * @description A http file send.
 * @see https://github.com/nuintun/file-send#readme
 */

'use strict';

const etag$1 = require('etag');
const fs = require('fs');
const fresh = require('fresh');
const http = require('http');
const destroy = require('destroy');
const Stream = require('stream');
const Events = require('events');
const encodeUrl = require('encodeurl');
const mime = require('mime-types');
const path$1 = require('path');
const micromatch = require('micromatch');
const escapeHtml = require('escape-html');
const parseRange$1 = require('range-parser');
const ms = require('ms');

/**
 * @module utils
 * @license MIT
 * @author nuintun
 */

const undef = void 0;
const toString = Object.prototype.toString;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * @function typeOf
 * @description The data type judgment
 * @param {any} value
 * @param {string} type
 * @returns {boolean}
 */
function typeOf(value, type) {
  // Format type
  type = String(type).toLowerCase();

  // Switch
  switch (type) {
    case 'nan':
      return Number.isNaN(value);
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'function':
      return typeof value === 'function';
    case 'undefined':
      return value === undef;
    default:
      // Get real type
      const realType = toString.call(value).toLowerCase();

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
function isOutBound(path, root) {
  path = path$1.relative(root, path);

  if (/\.\.(?:[\\/]|$)/.test(path)) return true;

  return false;
}

/**
 * @function unixify
 * @description Convert path separators to posix/unix-style forward slashes
 * @param {string} path
 * @returns {string}
 */
function unixify(path) {
  return path.replace(/\\/g, '/');
}

/**
 * @function normalize
 * @description Normalize path
 * @param {string} path
 * @returns {string}
 */
function normalize(path) {
  // \a\b\.\c\.\d ==> /a/b/./c/./d
  path = unixify(path);

  // :///a/b/c ==> ://a/b/c
  path = path.replace(/:\/{3,}/, '://');

  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(/\/\.\//g, '/');

  // a//b/c ==> a/b/c
  // //a/b/c ==> /a/b/c
  // a///b/////c ==> a/b/c
  path = path.replace(/(^|[^:])\/{2,}/g, '$1/');

  // Transfer path
  let src = path;
  // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  const DOUBLE_DOT_RE = /([^/]+)\/\.\.(?:\/|$)/g;

  // a/b/c/../../d ==> a/b/../d ==> a/d
  do {
    src = src.replace(DOUBLE_DOT_RE, (matched, dirname) => {
      return dirname === '..' ? matched : '';
    });

    // Break
    if (path === src) {
      break;
    } else {
      path = src;
    }
  } while (true);

  // Get path
  return path;
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

  return typeOf(timestamp, 'number') ? timestamp : NaN;
}

/**
 * @function pipeline
 * @param {Stream} streams
 * @return {Stream}
 */
function pipeline(streams) {
  let index = 0;
  let src = streams[index++];
  const length = streams.length;

  while (index < length) {
    let dest = streams[index++];

    // Listening error event
    src.once('error', error => {
      dest.emit('error', error);
    });

    src = src.pipe(dest);
  }

  return src;
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
        // ' '
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        // ','
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
  return (
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <meta name="renderer" content="webkit" />\n' +
    '    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />\n' +
    '    <meta content="text/html; charset=utf-8" http-equiv="content-type" />\n' +
    `    <title>${statusCode}</title>\n` +
    '    <style>\n' +
    '      html, body, div, p {\n' +
    '        text-align: center;\n' +
    '        margin: 0; padding: 0;\n' +
    '        font-family: Calibri, "Lucida Console", Consolas, "Liberation Mono", Menlo, Courier, monospace;\n' +
    '      }\n' +
    '      body { padding-top: 88px; }\n' +
    '      p { color: #0e90d2; line-height: 100%; }\n' +
    '      .ui-code { font-size: 200px; font-weight: bold; }\n' +
    '      .ui-message { font-size: 80px; }\n' +
    '    </style>\n' +
    '  </head>\n' +
    '  <body>\n' +
    `    <p class="ui-code">${statusCode}</p>\n` +
    `    <p class="ui-message">${statusMessage}</p>\n` +
    '  </body>\n' +
    '</html>\n'
  );
}

/**
 * @module through
 * @license MIT
 * @author nuintun
 */

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
 * @function through
 * @param {Object} options
 * @param {Function} transform
 * @param {Function} flush
 * @returns {Transform}
 */
function through(options, transform, flush, destroy) {
  if (typeOf(options, 'function')) {
    flush = transform;
    transform = options;
    options = {};
  } else if (!typeOf(transform, 'function')) {
    transform = noop;
  }

  if (!typeOf(flush, 'function')) flush = null;

  if (!typeOf(destroy, 'function')) destroy = null;

  options = options || {};

  if (typeOf(options.objectModem, 'undefined')) {
    options.objectMode = true;
  }

  if (typeOf(options.highWaterMark, 'undefined')) {
    options.highWaterMark = 16;
  }

  const stream = new Stream.Transform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;
  if (destroy) stream._destroy = destroy;

  return stream;
}

/**
 * @module async
 * @license MIT
 * @author nuintun
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
 * @function series
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
function series(array, iterator, done) {
  // Create a new iterator
  const it = new Iterator(array);

  /**
   * @function walk
   * @param it
   */
  function walk(it) {
    const item = it.next();

    if (item.done) {
      done();
    } else {
      iterator(item.value, () => walk(it), it.index);
    }
  }

  // Run walk
  walk(it);
}

/**
 * @module symbol
 * @license MIT
 * @author nuintun
 */

const dir = Symbol('dir');
const etag = Symbol('etag');
const path = Symbol('path');
const root = Symbol('root');
const glob = Symbol('glob');
const stdin = Symbol('stdin');
const error = Symbol('error');
const index = Symbol('index');
const ignore = Symbol('ignore');
const maxAge = Symbol('maxAge');
const charset = Symbol('charset');
const request = Symbol('request');
const isFresh = Symbol('isFresh');
const realpath = Symbol('realpath');
const response = Symbol('response');
const isIgnore = Symbol('isIgnore');
const sendFile = Symbol('sendFile');
const immutable = Symbol('immutable');
const sendIndex = Symbol('sendIndex');
const bootstrap = Symbol('bootstrap');
const statError = Symbol('statError');
const isCachable = Symbol('isCachable');
const parseRange = Symbol('parseRange');
const initHeaders = Symbol('initHeaders');
const responseEnd = Symbol('responseEnd');
const headersSent = Symbol('headersSent');
const middlewares = Symbol('middlewares');
const isRangeFresh = Symbol('isRangeFresh');
const ignoreAccess = Symbol('ignoreAccess');
const acceptRanges = Symbol('acceptRanges');
const cacheControl = Symbol('cacheControl');
const lastModified = Symbol('lastModified');
const hasTrailingSlash = Symbol('hasTrailingSlash');
const isConditionalGET = Symbol('isConditionalGET');
const isPreconditionFailure = Symbol('isPreconditionFailure');

/**
 * @module normalize
 * @license MIT
 * @author nuintun
 */

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @function normalizeCharset
 * @param {string} charset
 * @returns {string|null}
 */
function normalizeCharset(charset) {
  return charset && typeOf(charset, 'string') ? charset : null;
}

/**
 * @function normalizeRoot
 * @param {string} root
 * @returns {string}
 */
function normalizeRoot(root) {
  return unixify(typeOf(root, 'string') ? path$1.resolve(root) : CWD);
}

/**
 * @function normalizePath
 * @param {string} path
 * @returns {string|-1}
 */
function normalizePath(path) {
  path = decodeURI(path);

  return path === -1 ? path : normalize(path);
}

/**
 * @function normalizeRealpath
 * @param {string} root
 * @param {string} path
 * @returns {string|-1}
 */
function normalizeRealpath(root, path) {
  return path === -1 ? path : unixify(path$1.join(root, path));
}

/**
 * @function normalizeList
 * @param {Array} list
 * @returns {Array}
 */
function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter(item => item && typeOf(item, 'string'));
}

/**
 * @function normalizeAccess
 * @param {string} access
 * @returns {string}
 */
function normalizeAccess(access) {
  return access === 'ignore' ? access : 'deny';
}

/**
 * @function normalizeMaxAge
 * @param {string|number} maxAge
 * @returns {number}
 */
function normalizeMaxAge(maxAge) {
  maxAge = typeOf(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

/**
 * @function normalizeBoolean
 * @param {boolean} boolean
 * @param {boolean} def
 * @returns {boolean}
 */
function normalizeBoolean(boolean, def) {
  return typeOf(boolean, 'undefined') ? def : Boolean(boolean);
}

/**
 * @function normalizeGlob
 * @param {Object} glob
 * @returns {string}
 */
function normalizeGlob(glob) {
  glob = glob || {};
  glob.dot = normalizeBoolean(glob.dot, true);

  return glob;
}

/**
 * @module file-send
 * @license MIT
 * @author nuintun
 */

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
  constructor(request$1, path, options) {
    if (!(request$1 instanceof http.IncomingMessage)) {
      throw new TypeError('The param request must be a http request.');
    }

    if (!typeOf(path, 'string')) {
      throw new TypeError('The param path must be a string.');
    }

    super(options);

    this.path = path;
    this.root = options.root;
    this.index = options.index;
    this.ignore = options.ignore;
    this.maxAge = options.maxAge;
    this.charset = options.charset;
    this.etag = options.etag;
    this.ignoreAccess = options.ignoreAccess;
    this.immutable = options.immutable;
    this.acceptRanges = options.acceptRanges;
    this.cacheControl = options.cacheControl;
    this.lastModified = options.lastModified;

    this[middlewares] = [];
    this[request] = request$1;
    this[stdin] = through();
    this[glob] = normalizeGlob(options.glob);
  }

  /**
   * @property request
   * @method get
   */
  get request() {
    return this[request];
  }

  /**
   * @property response
   * @method get
   */
  get response() {
    const response$1 = this[response];

    if (!response$1) {
      throw new ReferenceError("Can't get http response before called pipe method.");
    }

    return response$1;
  }

  /**
   * @property method
   * @method get
   */
  get method() {
    return this.request.method;
  }

  /**
   * @property path
   * @method set
   */
  set path(path$1) {
    const root = this.root;

    path$1 = normalizePath(path$1);

    this[path] = path$1;
    this[realpath] = root ? normalizeRealpath(root, path$1) : path$1;
  }

  /**
   * @property path
   * @method get
   */
  get path() {
    return this[path];
  }

  /**
   * @property root
   * @method set
   */
  set root(root$1) {
    const path = this.path;

    root$1 = normalizeRoot(root$1);

    this[root] = root$1;
    this[realpath] = path ? normalizeRealpath(root$1, path) : root$1;
  }

  /**
   * @property root
   * @method get
   */
  get root() {
    return this[root];
  }

  /**
   * @property realpath
   * @method get
   */
  get realpath() {
    return this[realpath];
  }

  /**
   * @property index
   * @method set
   */
  set index(index$1) {
    this[index] = normalizeList(index$1);
  }

  /**
   * @property index
   * @method get
   */
  get index() {
    return this[index];
  }

  /**
   * @property ignore
   * @method set
   */
  set ignore(ignore$1) {
    this[ignore] = normalizeList(ignore$1);
  }

  /**
   * @property ignore
   * @method get
   */
  get ignore() {
    return this[ignore];
  }

  /**
   * @property ignoreAccess
   * @method set
   */
  set ignoreAccess(ignoreAccess$1) {
    this[ignoreAccess] = normalizeAccess(ignoreAccess$1);
  }

  /**
   * @property ignoreAccess
   * @method get
   */
  get ignoreAccess() {
    return this[ignoreAccess];
  }

  /**
   * @property maxAge
   * @method set
   */
  set maxAge(maxAge$1) {
    this[maxAge] = normalizeMaxAge(maxAge$1);
  }

  /**
   * @property maxAge
   * @method get
   */
  get maxAge() {
    return this[maxAge];
  }

  /**
   * @property charset
   * @method set
   */
  set charset(charset$1) {
    this[charset] = normalizeCharset(charset$1);
  }

  /**
   * @property charset
   * @method get
   */
  get charset() {
    return this[charset];
  }

  /**
   * @property etag
   * @method set
   */
  set etag(etag$1) {
    this[etag] = normalizeBoolean(etag$1, true);
  }

  /**
   * @property etag
   * @method get
   */
  get etag() {
    return this[etag];
  }

  /**
   * @property immutable
   * @method set
   */
  set immutable(immutable$1) {
    this[immutable] = normalizeBoolean(immutable$1, false);
  }

  /**
   * @property immutable
   * @method get
   */
  get immutable() {
    return this[immutable];
  }

  /**
   * @property acceptRanges
   * @method set
   */
  set acceptRanges(acceptRanges$1) {
    this[acceptRanges] = normalizeBoolean(acceptRanges$1, true);
  }

  /**
   * @property acceptRanges
   * @method get
   */
  get acceptRanges() {
    return this[acceptRanges];
  }

  /**
   * @property cacheControl
   * @method set
   */
  set cacheControl(cacheControl$1) {
    this[cacheControl] = normalizeBoolean(cacheControl$1, true);
  }

  /**
   * @property cacheControl
   * @method get
   */
  get cacheControl() {
    return this[cacheControl];
  }

  /**
   * @property lastModified
   * @method set
   */
  set lastModified(lastModified$1) {
    this[lastModified] = normalizeBoolean(lastModified$1, true);
  }

  /**
   * @property lastModified
   * @method get
   */
  get lastModified() {
    return this[lastModified];
  }

  /**
   * @property statusCode
   * @method set
   */
  set statusCode(statusCode) {
    this.response.statusCode = statusCode;
  }

  /**
   * @property statusCode
   * @method get
   */
  get statusCode() {
    return this.response.statusCode;
  }

  /**
   * @property statusMessage
   * @method set
   */
  set statusMessage(statusMessage) {
    this.response.statusMessage = statusMessage || http.STATUS_CODES[this.statusCode];
  }

  /**
   * @property statusMessage
   * @method get
   */
  get statusMessage() {
    return this.response.statusMessage;
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
    this.response.setHeader(name, value);
  }

  /**
   * @method getHeader
   * @param {string} name
   * @public
   */
  getHeader(name) {
    return this.response.getHeader(name);
  }

  /**
   * @method removeHeader
   * @param {string} name
   * @public
   */
  removeHeader(name) {
    this.response.removeHeader(name);
  }

  /**
   * @method removeHeaders
   * @public
   */
  hasHeader(name) {
    return this.response.hasHeader(name);
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
   * @method status
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  status(statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
  }

  /**
   * @method redirect
   * @param {string} location
   * @public
   */
  redirect(location) {
    const href = encodeUrl(location);
    const html = `Redirecting to <a href="${href}">${escapeHtml(location)}</a>`;

    this.status(301);
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(html));
    this.setHeader('Content-Security-Policy', "default-src 'self'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', href);
    this[responseEnd](html);
  }

  /**
   * @method pipe
   * @param {Response} response
   * @param {Object} options
   * @public
   */
  pipe(response$1, options) {
    if (this[response]) {
      throw new RangeError('The pipe method has been called more than once.');
    }

    if (!(response$1 instanceof http.ServerResponse)) {
      throw new TypeError('The response must be a http response.');
    }

    // Set response
    this[response] = response$1;

    // Headers already sent
    if (response$1.headersSent) {
      this[headersSent]();

      return response$1;
    }

    // Listening error event
    response$1.once('error', error => {
      this[statError](error);
    });

    // Bootstrap
    this[bootstrap]();

    // Pipeline
    const streams = [this[stdin]].concat(this[middlewares]);

    streams.push(response$1);

    return pipeline(streams);
  }

  /**
   * @method end
   * @param {string} chunk
   * @param {string} encoding
   * @param {Function} callback
   * @public
   */
  end(chunk, encoding, callback) {
    if (chunk) {
      this[stdin].end(chunk, encoding, callback);
    } else {
      this[stdin].end();
    }
  }

  /**
   * @method headersSent
   * @private
   */
  [headersSent]() {
    this[responseEnd]("Can't set headers after they are sent.");
  }

  /**
   * @method error
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  [error](statusCode, statusMessage) {
    const response = this.response;

    this.status(statusCode, statusMessage);

    statusCode = this.statusCode;
    statusMessage = this.statusMessage;

    const error = new Error(statusMessage);

    error.statusCode = statusCode;

    // Emit if listeners instead of responding
    if (this.hasListeners('error')) {
      this.emit('error', error, chunk => {
        if (response.headersSent) {
          return this[headersSent]();
        }

        this[responseEnd](chunk);
      });
    } else {
      if (response.headersSent) {
        return this[headersSent]();
      }

      // Error document
      const document = createErrorDocument(statusCode, statusMessage);

      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(document));
      this.setHeader('Content-Security-Policy', `default-src 'self' 'unsafe-inline'`);
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this[responseEnd](document);
    }
  }

  /**
   * @method statError
   * @param {Error} error
   * @private
   */
  [statError](error$1) {
    // 404 error
    if (NOT_FOUND.indexOf(error$1.code) !== -1) {
      return this[error](404);
    }

    this[error](500, error$1.message);
  }

  /**
   * @method hasTrailingSlash
   * @private
   */
  [hasTrailingSlash]() {
    return this.path[this.path.length - 1] === '/';
  }

  /**
   * @method isConditionalGET
   * @private
   */
  [isConditionalGET]() {
    const headers = this.request.headers;

    return headers['if-match'] || headers['if-unmodified-since'] || headers['if-none-match'] || headers['if-modified-since'];
  }

  /**
   * @method isPreconditionFailure
   * @private
   */
  [isPreconditionFailure]() {
    const request = this.request;
    // if-match
    const match = request.headers['if-match'];

    if (match) {
      const etag = this.getHeader('ETag');

      return (
        !etag ||
        (match !== '*' &&
          parseTokenList(match).every(match => {
            return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
          }))
      );
    }

    // if-unmodified-since
    const unmodifiedSince = parseHttpDate(request.headers['if-unmodified-since']);

    if (!isNaN(unmodifiedSince)) {
      const lastModified = parseHttpDate(this.getHeader('Last-Modified'));

      return isNaN(lastModified) || lastModified > unmodifiedSince;
    }

    return false;
  }

  /**
   * @method isCachable
   * @private
   */
  [isCachable]() {
    const statusCode = this.statusCode;

    return statusCode === 304 || (statusCode >= 200 && statusCode < 300);
  }

  /**
   * @method isFresh
   * @private
   */
  [isFresh]() {
    return fresh(this.request.headers, {
      etag: this.getHeader('ETag'),
      'last-modified': this.getHeader('Last-Modified')
    });
  }

  /**
   * @method isRangeFresh
   * @private
   */
  [isRangeFresh]() {
    const ifRange = this.request.headers['if-range'];

    if (!ifRange) {
      return true;
    }

    // If-Range as etag
    if (ifRange.indexOf('"') !== -1) {
      const etag = this.getHeader('ETag');

      return Boolean(etag && ifRange.indexOf(etag) !== -1);
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
  [isIgnore](path) {
    return this.ignore.length && micromatch.isMatch(path, this.ignore, this[glob]);
  }

  /**
   * @method parseRange
   * @param {Stats} stats
   * @private
   */
  [parseRange](stats) {
    const result = [];
    const size = stats.size;
    let contentLength = size;

    // Range support
    if (this.acceptRanges) {
      let ranges = this.request.headers['range'];

      // Range fresh
      if (ranges && this[isRangeFresh]()) {
        // Parse range -1 -2 or []
        ranges = parseRange$1(size, ranges, { combine: true });

        // Valid ranges, support multiple ranges
        if (Array.isArray(ranges) && ranges.type === 'bytes') {
          this.status(206);

          // Multiple ranges
          if (ranges.length > 1) {
            // Range boundary
            let boundary = `<${boundaryGenerator()}>`;
            // If user set content-type use user define
            const contentType = this.getHeader('Content-Type') || 'application/octet-stream';

            // Set multipart/byteranges
            this.setHeader('Content-Type', `multipart/byteranges; boundary=${boundary}`);

            // Create boundary and end boundary
            boundary = `\r\n--${boundary}`;

            // Closed boundary
            const close = `${boundary}--\r\n`;

            // Common boundary
            boundary += `\r\nContent-Type: ${contentType}`;

            // Reset content-length
            contentLength = 0;

            // Map ranges
            ranges.forEach(range => {
              // Range start and end
              const start = range.start;
              const end = range.end;
              // Set fields
              const open = `${boundary}\r\nContent-Range: bytes ${start}-${end}/${size}\r\n\r\n`;

              // Set property
              range.open = open;
              // Compute content-length
              contentLength += end - start + Buffer.byteLength(open) + 1;

              // Cache range
              result.push(range);
            });

            // The first open boundary remove \r\n
            result[0].open = result[0].open.replace(/^\r\n/, '');
            // The last add closed boundary
            result[result.length - 1].close = close;

            // Compute content-length
            contentLength += Buffer.byteLength(close);
          } else {
            const range = ranges[0];
            const start = range.start;
            const end = range.end;

            // Set content-range
            this.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);

            // Cache range
            result.push(range);

            // Compute content-length
            contentLength = end - start + 1;
          }
        } else if (ranges === -1) {
          return ranges;
        }
      }
    }

    // Set content-length
    this.setHeader('Content-Length', contentLength);

    // If non range return all file
    if (!result.length) {
      result.push({});
    }

    // Return result
    return result;
  }

  /**
   * @method dir
   * @private
   */
  [dir]() {
    // If have event directory listener, use user define
    // emit event directory
    if (this.hasListeners('dir')) {
      this.emit('dir', this.realpath, chunk => {
        if (this.response.headersSent) {
          return this[headersSent]();
        }

        this[responseEnd](chunk);
      });
    } else {
      this[error](403);
    }
  }

  /**
   * @method initHeaders
   * @param {Stats} stats
   * @private
   */
  [initHeaders](stats) {
    // Accept-Ranges
    if (this.acceptRanges) {
      // Set Accept-Ranges
      this.setHeader('Accept-Ranges', 'bytes');
    }

    // Content-Type
    if (!this.hasHeader('Content-Type')) {
      // Get type
      let type = mime.lookup(this.path);

      if (type) {
        let charset = this.charset;

        // Get charset
        charset = charset ? `; charset=${charset}` : '';

        // Set Content-Type
        this.setHeader('Content-Type', type + charset);
      }
    }

    // Cache-Control
    if (this.cacheControl && !this.hasHeader('Cache-Control')) {
      let cacheControl = `public, max-age=${this.maxAge}`;

      if (this.immutable) {
        cacheControl += ', immutable';
      }

      // Set Cache-Control
      this.setHeader('Cache-Control', cacheControl);
    }

    // Last-Modified
    if (this.lastModified && !this.hasHeader('Last-Modified')) {
      // Get mtime utc string
      this.setHeader('Last-Modified', stats.mtime.toUTCString());
    }

    if (this.etag && !this.hasHeader('ETag')) {
      // Set ETag
      this.setHeader('ETag', etag$1(stats));
    }
  }

  /**
   * @method responseEnd
   * @param {string} chunk
   * @param {string} chunk
   * @param {Function} chunk
   * @private
   */
  [responseEnd](chunk, encoding, callback) {
    const response = this.response;

    if (response) {
      if (chunk) {
        response.end(chunk, encoding, callback);
      } else {
        response.end();
      }
    }

    // Destroy stdin stream
    destroy(this[stdin]);
  }

  /**
   * @method sendIndex
   * @private
   */
  [sendIndex]() {
    const hasTrailingSlash$1 = this[hasTrailingSlash]();
    const path = hasTrailingSlash$1 ? this.path : `${this.path}/`;

    // Iterator index
    series(
      this.index.map(index => path + index),
      (path, next) => {
        if (this[isIgnore](path)) {
          return next();
        }

        fs.stat(this.root + path, (error, stats) => {
          if (error || !stats.isFile()) {
            return next();
          }

          this.redirect(unixify(path));
        });
      },
      () => {
        if (hasTrailingSlash$1) {
          return this[dir]();
        }

        this.redirect(path);
      }
    );
  }

  /**
   * @method sendFile
   * @private
   */
  [sendFile](ranges) {
    const realpath = this.realpath;
    const stdin$1 = this[stdin];

    // Iterator ranges
    series(
      ranges,
      (range, next, index) => {
        // Write open boundary
        range.open && stdin$1.write(range.open);

        // Create file stream
        const file = fs.createReadStream(realpath, range);

        // Error handling code-smell
        file.on('error', error => {
          // Emit stdin error
          stdin$1.emit('error', error);

          // Destroy file stream
          destroy(file);
        });

        // File stream end
        file.on('end', () => {
          // Stop pipe stdin
          file.unpipe(stdin$1);

          // Push close boundary
          range.close && stdin$1.write(range.close);

          // Destroy file stream
          destroy(file);
        });

        // Next
        file.on('close', next);

        // Pipe stdin
        file.pipe(
          stdin$1,
          { end: false }
        );
      },
      // End stdin
      () => this.end()
    );
  }

  /**
   * @method bootstrap
   * @private
   */
  [bootstrap]() {
    const method = this.method;
    const response = this.response;
    const realpath = this.realpath;

    // Only support GET and HEAD
    if (method !== 'GET' && method !== 'HEAD') {
      // End with empty content
      return this[error](405);
    }

    // Set status
    this.status(response.statusCode || 200);

    // Path -1 or null byte(s)
    if (this.path === -1 || this.path.indexOf('\0') !== -1) {
      return this[error](400);
    }

    // Malicious path
    if (isOutBound(realpath, this.root)) {
      return this[error](403);
    }

    // Is ignore path or file
    if (this[isIgnore](this.path)) {
      switch (this.ignoreAccess) {
        case 'deny':
          return this[error](403);
        case 'ignore':
          return this[error](404);
      }
    }

    // Read file
    fs.stat(realpath, (error$1, stats) => {
      // Stat error
      if (error$1) {
        return this[statError](error$1);
      }

      // Is directory
      if (stats.isDirectory()) {
        return this[sendIndex]();
      } else if (this[hasTrailingSlash]()) {
        // Not a directory but has trailing slash
        return this[error](404);
      }

      // Set headers and parse range
      this[initHeaders](stats);

      // Conditional get support
      if (this[isConditionalGET]()) {
        const responseEnd$1 = () => {
          // Remove content-type
          this.removeHeader('Content-Type');

          // End with empty content
          this[responseEnd]();
        };

        if (this[isPreconditionFailure]()) {
          this.status(412);

          return responseEnd$1();
        } else if (this[isCachable]() && this[isFresh]()) {
          this.status(304);

          return responseEnd$1();
        }
      }

      // Head request
      if (method === 'HEAD') {
        // Set content-length
        this.setHeader('Content-Length', stats.size);

        // End with empty content
        return this[responseEnd]();
      }

      // Parse ranges
      const ranges = this[parseRange](stats);

      // 416
      if (ranges === -1) {
        // Set content-range
        this.setHeader('Content-Range', `bytes */${stats.size}`);
        // Unsatisfiable 416
        this[error](416);
      } else {
        // Emit file event
        if (this.hasListeners('file')) {
          this.emit('file', realpath, stats);
        }

        // Read file
        this[sendFile](ranges);
      }
    });
  }
}

// Exports mime
FileSend.mime = mime;

module.exports = FileSend;
