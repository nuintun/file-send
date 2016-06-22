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
var BACKSLASHRE = /\\/g; // backslash
var toString = Object.prototype.toString; // prototype method toString
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * normalize path
 * @param path
 * @returns {string}
 */
function normalize(path){
  return path
    .replace(/\\+/g, '/')
    .replace(/([^:/])\/+\//g, '$1/')
    .replace(/(:)?\/{2,}/, '$1//');
}

// exports util
module.exports = {
  /**
   * isOutBound
   * Test path is out of bound of base
   * @param path
   * @param base
   * @returns {boolean}
   */
  isOutBound: function (path, base){
    if (process.platform === 'win32') {
      path = path.toLowerCase();
      base = base.toLowerCase();
    }

    if (path.length < base.length) {
      return true;
    }

    return path.indexOf(base) !== 0;
  },
  /**
   * isType
   * data type judgment
   * @param data
   * @param type
   * @returns {boolean}
   */
  isType: function (data, type){
    // get real type
    var realType = toString.call(data).toLowerCase();

    // format type
    type = (type + '').toLowerCase();

    switch (type) {
      case 'nan':
        // nan
        return realType === '[object number]' && data !== data;
      case 'error':
        // error
        return data instanceof Error || realType === '[object error]';
      default :
        // other
        return realType === '[object ' + type + ']';
    }
  },
  /**
   * posixPath
   * format path to posix style
   * @param path
   * @returns {string}
   */
  posixPath: function (path){
    // reset BACKSLASHRE math index
    BACKSLASHRE.lastIndex = 0;
    // replace
    return normalize(path).replace(BACKSLASHRE, '/');
  },
  /**
   * decodeURI
   * decode URI component.
   * @param uri
   * @returns {*}
   */
  decodeURI: function (uri){
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
  boundaryGenerator: function (){
    var boundary = '';

    // create boundary
    for (var i = 0; i < 38; i++) {
      boundary += CHARS[Math.floor(Math.random() * 62)];
    }

    // return boundary
    return boundary;
  },
  /**
   * defineProperty
   * define a property
   * @param object
   * @param prop
   * @param descriptor
   */
  defineProperty: function (object, prop, descriptor){
    descriptor = descriptor || {};

    descriptor.__proto__ = null;

    Object.defineProperty(object, prop, descriptor);
  }
};
