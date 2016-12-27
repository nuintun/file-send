/*!
 * util
 * Date: 2016/6/21
 * https://github.com/Nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// external lib
var path = require('path');

// variable declaration
var BACKSLASH_RE = /\\/g;
var DOT_RE = /\/\.\//g;
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//;
var MULTI_SLASH_RE = /([^:/])\/+\//g;
var PROTOCOL_SLASH_RE = /(:)?\/{2,}/;
var toString = Object.prototype.toString;
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

// exports util
module.exports = {
  /**
   * isType
   * data type judgment
   * @param value
   * @param type
   * @returns {boolean}
   */
  isType: function(value, type) {
    // format type
    type = (type + '').toLowerCase();

    // is array
    if (type === 'array') {
      return Array.isArray(value);
    }

    // get real type
    var realType = toString.call(value).toLowerCase();

    // switch
    switch (type) {
      case 'nan':
        // nan
        return realType === '[object number]' && value !== value;
      default:
        // other
        return realType === '[object ' + type + ']';
    }
  },
  /**
   * isOutBound
   * Test path is out of bound of base
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
   * normalize path
   * @param path
   * @returns {string}
   */
  normalize: function(path) {
    // \a\b\.\c\.\d ==> /a/b/./c/./d
    path = path.replace(BACKSLASH_RE, '/');

    // :///a/b/c ==> ://a/b/c
    path = path.replace(PROTOCOL_SLASH_RE, '$1//');

    // /a/b/./c/./d ==> /a/b/c/d
    path = path.replace(DOT_RE, '/');

    // @author wh1100717
    // a//b/c ==> a/b/c
    // a///b/////c ==> a/b/c
    // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
    path = path.replace(MULTI_SLASH_RE, '$1/');

    // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
    while (path.match(DOUBLE_DOT_RE)) {
      path = path.replace(DOUBLE_DOT_RE, '/');
    }

    // get path
    return path;
  },
  /**
   * posixURI
   * format path to posix style
   * @param path
   * @returns {string}
   */
  posixURI: function(path) {
    return path.replace(BACKSLASH_RE, '/');
  },
  /**
   * decodeURI
   * decode URI component.
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
   * create boundary
   * @returns {string}
   */
  boundaryGenerator: function() {
    var boundary = '';

    // create boundary
    for (var i = 0; i < 38; i++) {
      boundary += CHARS[Math.floor(Math.random() * 62)];
    }

    // return boundary
    return boundary;
  }
};
