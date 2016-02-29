/**
 * file-send
 * https://nuintun.github.io/file-send
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// External lib
var path = require('path');

// Variable declaration
var util = {}; // Namespace
var BACKSLASHRE = /\\/g; // Backslash
var DOTFILERE = /^\.|[\\/]\.[^.\\/]/g; // Is dot file or directory
var toString = Object.prototype.toString; // Prototype method toString
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Normalize path
 * @param path
 * @returns {string}
 */
function normalize(path){
  path = path.replace(/\\+/g, '/');
  path = path.replace(/([^:/])\/+\//g, '$1/');
  path = path.replace(/(:)?\/{2,}/, '$1//');

  return path;
}

/**
 * Test path is out of bound of base
 * @param path
 * @param base
 * @returns {boolean}
 */
util.isOutBound = function (path, base){
  if (process.platform === 'win32') {
    path = path.toLowerCase();
    base = base.toLowerCase();
  }

  if (path.length < base.length) return true;

  return path.indexOf(base) !== 0;
};

/**
 * Date type judgment
 * @param data
 * @param type
 * @returns {boolean}
 */
util.isType = function (data, type){
  // Get real type
  var realType = toString.call(data).toLowerCase();

  // Format type
  type = (type + '').toLowerCase();

  switch (type) {
    case 'nan':
      // NaN
      return realType === '[object number]' && data !== data;
    case 'error':
      // Error
      return data instanceof Error || realType === '[object error]';
    default :
      // Other
      return realType === '[object ' + type + ']';
  }
};

/**
 * Format path to http style
 * @param {String} path
 * @returns {String}
 */
util.httpPath = function (path){
  // Reset BACKSLASHRE math index
  BACKSLASHRE.lastIndex = 0;
  // Replace
  return normalize(path).replace(BACKSLASHRE, '/');
};

/**
 * Determine if path parts contain a dotfile.
 * @api private
 */
util.containsDotFile = function (path){
  // Reset DOTFILERE math index
  DOTFILERE.lastIndex = 0;
  // Math
  return DOTFILERE.test(path);
};

/**
 * Decode URI component.
 * Allows V8 to only deoptimize this fn instead of all of send()
 * @param {String} uri
 * @api private
 */
util.decode = function (uri){
  try {
    return decodeURIComponent(uri);
  } catch (err) {
    return -1;
  }
};

/**
 * Normalize the index option into an array
 * @param {String|String[]} data
 * @api private
 */
util.normalizeList = function (data){
  var list = [];
  var type = toString.call(data);

  // Data is string
  if (type === '[object String]') {
    list.push(data);
  }

  // Data is array
  if (type === '[object Array]') {
    list = list.concat(data.filter(function (item){
      return util.isType(item, 'string');
    }));
  }

  // Return list
  return list;
};

/**
 * Create boundary
 * @returns {string}
 */
util.boundaryGenerator = function (){
  var uuid = '';

  // Create boundary
  for (var i = 0; i < 38; i++) {
    uuid += CHARS[Math.floor(Math.random() * 62)];
  }

  // Return boundary
  return uuid;
};

/**
 * Define a private property
 * @param {Object} object
 * @param {String} prop
 * @param {*=} value
 * @param {Boolean=} writable
 */
util.privateProperty = function (object, prop, value, writable){
  Object.defineProperty(object, prop, {
    __proto__: null,
    writable: !!writable,
    enumerable: false,
    configurable: false,
    value: value
  });
};

/**
 * Define a readonly property
 * @param {Object} object
 * @param {String} prop
 * @param {*=} value
 */
util.readonlyProperty = function (object, prop, value){
  Object.defineProperty(object, prop, {
    __proto__: null,
    writable: false,
    enumerable: true,
    configurable: false,
    value: value
  });
};

// Exports util
module.exports = util;
