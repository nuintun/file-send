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

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * @function typeIs
 * @description The data type judgment
 * @param {any} value
 * @param {string} type
 * @returns {boolean}
 */


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


/**
 * @function throuth
 * @description Create a new export function, contains common logic for dealing with arguments
 * @param {Object} [options]
 * @param {Function} transform
 * @param {Function} [flush]
 * @returns {DestroyableTransform}
 */

/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

// Current working directory
const CWD = process.cwd();
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
  constructor(request, path$$1, options) {
    super();
  }

  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  headersSent(response) {
    if (response.headersSent) {
      this.unpipe(response);
      response.end('Can\'t set headers after they are sent.');
    }
  }
}

module.exports = FileSend;
