/**
 * nengine
 * https://nuintun.github.io/file-send
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/nengine/blob/master/LICENSE
 */

'use strict';

var util = {}, // Namespace
  BACKSLASHRE = /\\/g, // Backslash
  normalize = require('path').normalize,
  DOTFILERE = /^\.|[\\/]\.[^.\\/]/g, // Is dot file or directory
  toString = Object.prototype.toString, // Prototype method toString
  hasOwn = Object.prototype.hasOwnProperty, // Prototype method hasOwnProperty
  EventEmitter = require('events').EventEmitter,
  CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Mix object
 * @returns {{}}
 */
util.mix = function mix(){
  var result = {},
    key, obj, i = 0,
    len = arguments.length;

  for (; i < len; ++i) {
    obj = arguments[i];

    for (key in obj) {
      if (hasOwn.call(obj, key)) {
        result[key] = obj[key];
      }
    }
  }

  // Return mixed object
  return result;
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
  var list = [],
    type = toString.call(data);

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
 * Shim EventEmitter.listenerCount for node.js < 0.10
 * @param emitter
 * @param type
 * @returns {Number}
 */
util.listenerCount = EventEmitter.listenerCount || function (emitter, type){
  var ret;

  // Not EventEmitter
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (util.isType(emitter._events[type], 'function'))
  // Not function
    ret = 1;
  else
  // Get events type listener
    ret = emitter._events[type].length;

  return ret;
};

// Exports util
module.exports = util;