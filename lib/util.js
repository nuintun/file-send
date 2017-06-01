/*!
 * util
 * Date: 2016/6/21
 * https://github.com/nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// Import lib
var path = require('path');

// Variable declaration
var toString = Object.prototype.toString;
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * typeIs
 * @description The data type judgment
 *
 * @param {any} value
 * @param {String} type
 * @returns {Boolean}
 */
function typeIs(value, type) {
  // Format type
  type = (type + '').toLowerCase();

  // Is array
  if (type === 'array') {
    return Array.isArray(value);
  }

  // Get real type
  var realType = toString.call(value).toLowerCase();

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

// Exports util
module.exports = {
  typeIs: typeIs,
  /**
   * isOutBound
   * @description Test path is out of bound of base
   *
   * @param {String} path
   * @param {String} root
   * @returns {Boolean}
   */
  isOutBound: function(path, root) {
    if (process.platform === 'win32') {
      path = path.toLowerCase();
      root = root.toLowerCase();
    }

    if (path.length < root.length) {
      return true;
    }

    return path.indexOf(root) !== 0;
  },
  /**
   * normalize
   * @description Normalize path
   *
   * @param {String} path
   * @returns {String}
   */
  normalize: function normalize(path) {
    // \a\b\.\c\.\d ==> /a/b/./c/./d
    path = path.replace(/\\/g, '/');

    // :///a/b/c ==> ://a/b/c
    path = path.replace(/(:)?\/{2,}/, '$1//');

    // /a/b/./c/./d ==> /a/b/c/d
    path = path.replace(/\/\.\//g, '/');

    // @author wh1100717
    // a//b/c ==> a/b/c
    // a///b/////c ==> a/b/c
    path = path.replace(/([^:/])\/+\//g, '$1/');

    // transfer path
    var src = path;
    // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
    var DOUBLE_DOT_RE = /([^/]+)\/\.\.(?:\/|$)/g;

    // a/b/c/../../d ==> a/b/../d ==> a/d
    do {
      src = src.replace(DOUBLE_DOT_RE, function(matched, dirname) {
        return dirname === '..' ? matched : '';
      });

      // break
      if (path === src) {
        break;
      } else {
        path = src;
      }
    } while (true);

    // Get path
    return path;
  },
  /**
   * posixURI
   * @description Format URI to posix style
   *
   * @param {String} path
   * @returns {String}
   */
  posixURI: function(path) {
    return path.replace(/\\/g, '/');
  },
  /**
   * decodeURI
   * @description Decode URI component.
   *
   * @param {String} uri
   * @returns {String|-1}
   */
  decodeURI: function(uri) {
    try {
      return decodeURIComponent(uri);
    } catch (err) {
      return -1;
    }
  },
  /**
   * boundaryGenerator
   * @description Create boundary
   *
   * @returns {string}
   */
  boundaryGenerator: function() {
    var boundary = '';

    // Create boundary
    for (var i = 0; i < 38; i++) {
      boundary += CHARS[Math.floor(Math.random() * 62)];
    }

    // Return boundary
    return boundary;
  },
  /**
   * parseHttpDate
   *
   * @description Parse an HTTP Date into a number.
   * @param {string} date
   * @private
   */
  parseHttpDate: function(date) {
    var timestamp = date && Date.parse(date);

    return typeIs(timestamp, 'number') ? timestamp : NaN;
  }
};
