/*!
 * util
 * Date: 2016/6/21
 * https://github.com/Nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// Import lib
var path = require('path');

// Variable declaration
var toString = Object.prototype.toString;
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

// Exports util
module.exports = {
  /**
   * typeIs
   * The data type judgment
   *
   * @param value
   * @param type
   * @returns {boolean}
   */
  typeIs: function(value, type) {
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
  },
  /**
   * isOutBound
   * Test path is out of bound of base
   *
   * @param path
   * @param root
   * @returns {boolean}
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
   * Normalize path
   *
   * @param path
   * @returns {string}
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
   * Format URI to posix style
   *
   * @param path
   * @returns {string}
   */
  posixURI: function(path) {
    return path.replace(/\\/g, '/');
  },
  /**
   * decodeURI
   * Decode URI component.
   *
   * @param uri
   * @returns {*}
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
   *
   * Create boundary
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
  }
};
