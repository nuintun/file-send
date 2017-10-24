/*!
 * utils
 *
 * Date: 2017/10/24
 *
 * This is licensed under the MIT License (MIT).
 */

'use strict';

const path = require('path');

const toString = Object.prototype.toString;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * @function typeIs
 * @description The data type judgment
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
 * @param {String} path
 * @param {String} root
 * @returns {Boolean}
 */
function isOutBound(path, root) {
  if (process.platform === 'win32') {
    path = path.toLowerCase();
    root = root.toLowerCase();
  }

  if (path.length < root.length) {
    return true;
  }

  return path.indexOf(root) !== 0;
}

/**
 * @function normalize
 * @description Normalize path
 * @param {String} path
 * @returns {String}
 */
function normalize(path) {
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

  // Transfer path
  let src = path;
  // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  const DOUBLE_DOT_RE = /([^/]+)\/\.\.(?:\/|$)/g;

  // a/b/c/../../d ==> a/b/../d ==> a/d
  do {
    src = src.replace(DOUBLE_DOT_RE, function(matched, dirname) {
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
 * @function posixURI
 * @description Format URI to posix style
 * @param {String} path
 * @returns {String}
 */
function posixURI(path) {
  return path.replace(/\\/g, '/');
}

/**
 * @function decodeURI
 * @description Decode URI component.
 * @param {String} uri
 * @returns {String|-1}
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

  return typeIs(timestamp, 'number') ? timestamp : NaN;
}

/**
 * @function Faster apply
 * @description Call is faster than apply, optimize less than 6 args
 * @param  {Function} fn
 * @param  {any} context
 * @param  {Array} args
 * @see https://github.com/micro-js/apply
 * @see http://blog.csdn.net/zhengyinhui100/article/details/7837127
 */
function apply(fn, context, args) {
  switch (args.length) {
    // Faster
    case 0:
      return fn.call(context);
    case 1:
      return fn.call(context, args[0]);
    case 2:
      return fn.call(context, args[0], args[1]);
    case 3:
      return fn.call(context, args[0], args[1], args[2]);
    default:
      // Slower
      return fn.apply(context, args);
  }
}

// Exports util
module.exports = {
  typeIs,
  isOutBound,
  normalize,
  posixURI,
  decodeURI,
  boundaryGenerator,
  parseHttpDate,
  apply
};
