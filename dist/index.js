'use strict';

require('ms');
require('fs');
var http = require('http');
require('etag');
require('fresh');
var Stream = require('stream');
require('destroy');
require('mime-types');
require('encodeurl');
require('micromatch');
require('on-finished');
require('escape-html');
require('range-parser');
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
    src = src.replace(DOUBLE_DOT_RE, function(matched, dirname) {
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


/**
 * @function parseHttpDate
 * @description Parse an HTTP Date into a number.
 * @param {string} date
 * @private
 */


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
 * @function setHeaders
 * @param {Response} response
 * @param {Object} headers
 */
function setHeaders(response, headers) {
  Object
    .keys(headers)
    .forEach(function(key) {
      response.setHeader(key, headers[key]);
    });
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
 * @module async
 * @license MIT
 * @version 2017/10/25
 */

/**
 * @class Iterator
 */


/**
 * series
 *
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */

/**
 * @module through
 * @license MIT
 * @version 2017/10/25
 */

/**
 * @class DestroyableTransform
 */


/**
 * @function throuth
 * @description Create a new export function, contains common logic for dealing with arguments
 * @param {Object} [options]
 * @param {Function} transform
 * @param {Function} [flush]
 * @returns {DestroyableTransform}
 */

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

function normalizeCharset(charset) {
  return util.typeIs(charset, 'string') ? charset : null;
}

function normalizeRoot(root) {
  return util.posixURI(util.typeIs(root, 'string') ? path.resolve(root) : CWD);
}

function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter(function(item) {
    return item && typeIs(item, 'string');
  })
}

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

function normalizePath(path$$1) {
  path$$1 = decodeURI(path$$1);

  return path$$1 === -1 ? path$$1 : normalize(path$$1);
}

function normalizeMaxAge(maxAge) {
  maxAge = typeIs(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

function normalizeBoolean(boolean, def) {
  return isUndefined(boolean) ? def : Boolean(boolean);
}

/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

// Headers key symbol
const headers = Symbol('headers');
const middlewares = Symbol('middlewares');

/**
 * @class FileSend
 */
class FileSend extends Stream {
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

    super();

    this[headers] = {};
    this[middlewares] = [];
    this.request = request;
    this.method = request.method;
    this.path = normalizePath(path$$1);
    this.root = normalizeRoot(options.root);
    this.index = normalizeList(options.index);
    this.ignore = normalizeList(options.ignore);
    this.maxAge = normalizeMaxAge(options.maxAge);
    this.charset = normalizeCharset(options.charset);
    this.etag = normalizeBoolean(options.etag, true);
    this.ignoreAccess = normalizeAccess(options.ignoreAccess);
    this.immutable = normalizeBoolean(options.immutable, false);
    this.acceptRanges = normalizeBoolean(options.acceptRanges, true);
    this.cacheControl = normalizeBoolean(options.cacheControl, true);
    this.lastModified = normalizeBoolean(options.lastModified, true);
  }

  use(middleware) {
    if (middleware instanceof Stream.Transform) {
      this[middlewares].push(middleware);
    }
  }

  setHeader(name, value) {
    this[headers][name.toLowerCase()] = value;
  }

  getHeader(name) {
    return this[headers][name.toLowerCase()];
  }

  getHeaders() {
    return this[headers];
  }

  removeHeader(name) {
    delete this[headers][name.toLowerCase()];
  }

  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  headersSent(response) {
    response.end('Can\'t set headers after they are sent.');
  }

  status(response, statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

    response.statusCode = this.statusCode;
    response.statusMessage = this.statusMessage;
  }

  error(response, statusCode, statusMessage) {
    this.status(response, statusCode, statusMessage);

    statusCode = this.statusCode;
    statusMessage = this.statusMessage;

    const error = new Error(statusMessage);

    error.statusCode = statusCode;

    // Emit if listeners instead of responding
    if (this.hasListeners('error')) {
      this.emit('error', error, (message) => {
        if (response.headersSent) {
          return this.headersSent(response);
        }

        response.end(message);
      });
    } else {
      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(statusMessage));
      this.setHeader('Content-Security-Policy', "default-src 'self'");
      this.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }

  statError() {

  }

  hasTrailingSlash() {
    return this.path[this.path.length - 1] === '/';
  }

  isConditionalGET() {
    const headers = this.request.headers;

    return headers['if-match']
      || headers['if-unmodified-since']
      || headers['if-none-match']
      || headers['if-modified-since'];
  }

  pipe(response, options) {
    if (!response instanceof http.ServerResponse) {
      throw new TypeError('The param response must be a http response.')
    }

    if (response.headersSent) {
      this.headersSent(response);

      return response;
    }

    setHeaders(response, this.getHeaders());

    const streams = [this];

    streams.concat(this[middlewares]);

    streams.push(response);

    return pipeline(streams);
  }
}

module.exports = FileSend;
