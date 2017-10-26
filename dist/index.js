'use strict';

require('ms');
require('fs');
require('url');
require('path');
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

/**
 * @module utils
 * @license MIT
 * @version 2017/10/24
 */

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

    process.nextTick(function() {
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
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

// Current working directory
const CWD = process.cwd();
// Common method
const originWriteHead = http.ServerResponse.prototype.writeHead;

// Add http response write headers events
http.ServerResponse.prototype.writeHead = function() {
  // Emit headers event
  if (this.listenerCount('headers') > 0) {
    this.emit('headers');
  }

  // Call origin method
  util.apply(originWriteHead, this, arguments);
};

/**
 * @class FileSend
 */

class FileSend extends Stream {
  /**
   * @constructor
   * @param {Request} request
   * @param {Object} options
   */
  constructor(request, response, options) {}
}

console.log(through(function() {}));

module.exports = FileSend;
