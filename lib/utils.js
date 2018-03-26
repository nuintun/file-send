/**
 * @module utils
 * @license MIT
 * @version 2017/10/24
 */

import { relative } from 'path';

const toString = Object.prototype.toString;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

export const undef = void 0;

/**
 * @function typeOf
 * @description The data type judgment
 * @param {any} value
 * @param {string} type
 * @returns {boolean}
 */
export function typeOf(value, type) {
  // Format type
  type = String(type).toLowerCase();

  // Switch
  switch (type) {
    case 'nan':
      return Number.isNaN(value);
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'function':
      return typeof value === 'function';
    case 'undefined':
      return value === undef;
    default:
      // Get real type
      const realType = toString.call(value).toLowerCase();

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
export function isOutBound(path, root) {
  path = relative(root, path);

  if (/\.\.(?:[\\/]|$)/.test(path)) return true;

  return false;
}

/**
 * @function normalize
 * @description Normalize path
 * @param {string} path
 * @returns {string}
 */
export function normalize(path) {
  // \a\b\.\c\.\d ==> /a/b/./c/./d
  path = path.replace(/\\/g, '/');

  // :///a/b/c ==> ://a/b/c
  path = path.replace(/:\/{3,}/, '://');

  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(/\/\.\//g, '/');

  // a//b/c ==> a/b/c
  // //a/b/c ==> /a/b/c
  // a///b/////c ==> a/b/c
  path = path.replace(/(^|[^:])\/{2,}/g, '$1/');

  // Transfer path
  let src = path;
  // DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  const DOUBLE_DOT_RE = /([^/]+)\/\.\.(?:\/|$)/g;

  // a/b/c/../../d ==> a/b/../d ==> a/d
  do {
    src = src.replace(DOUBLE_DOT_RE, (matched, dirname) => {
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
 * @function unixify
 * @description Convert path separators to posix/unix-style forward slashes
 * @param {string} path
 * @returns {string}
 */
export function unixify(path) {
  return path.replace(/\\/g, '/');
}

/**
 * @function decodeURI
 * @description Decode URI component.
 * @param {string} uri
 * @returns {string|-1}
 */
export function decodeURI(uri) {
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
export function boundaryGenerator() {
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
export function parseHttpDate(date) {
  const timestamp = date && Date.parse(date);

  return typeOf(timestamp, 'number') ? timestamp : NaN;
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
export function apply(fn, context, args) {
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

/**
 * @function isUndefined
 * @param {any} value
 */
export function isUndefined(value) {
  return value === undef;
}

/**
 * @function pipeline
 * @param {Stream} streams
 * @return {Stream}
 */
export function pipeline(streams) {
  let index = 0;
  let src = streams[index++];
  const length = streams.length;

  while (index < length) {
    let dest = streams[index++];

    // Listening error event
    src.once('error', error => {
      dest.emit('error', error);
    });

    src = src.pipe(dest);
  }

  return src;
}

/**
 * @function parseTokenList
 * @description Parse a HTTP token list.
 * @param {string} value
 */
export function parseTokenList(value) {
  let end = 0;
  let list = [];
  let start = 0;

  // gather tokens
  for (let i = 0, length = value.length; i < length; i++) {
    switch (value.charCodeAt(i)) {
      case 0x20:
        // ' '
        if (start === end) {
          start = end = i + 1;
        }
        break;
      case 0x2c:
        // ','
        list.push(value.substring(start, end));
        start = end = i + 1;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  // final token
  list.push(value.substring(start, end));

  return list;
}

/**
 * @function createErrorDocument
 * @param {number} statusCode
 * @param {string} statusMessage
 * @returns {string}
 */
export function createErrorDocument(statusCode, statusMessage) {
  return (
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <meta name="renderer" content="webkit" />\n' +
    '    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />\n' +
    '    <meta content="text/html; charset=utf-8" http-equiv="content-type" />\n' +
    `    <title>${statusCode}</title>\n` +
    '    <style>\n' +
    '      html, body, div, p {\n' +
    '        text-align: center;\n' +
    '        margin: 0; padding: 0;\n' +
    '        font-family: Calibri, "Lucida Console", Consolas, "Liberation Mono", Menlo, Courier, monospace;\n' +
    '      }\n' +
    '      body { padding-top: 88px; }\n' +
    '      p { color: #0e90d2; line-height: 100%; }\n' +
    '      .ui-code { font-size: 200px; font-weight: bold; }\n' +
    '      .ui-message { font-size: 80px; }\n' +
    '    </style>\n' +
    '  </head>\n' +
    '  <body>\n' +
    `    <p class="ui-code">${statusCode}</p>\n` +
    `    <p class="ui-message">${statusMessage}</p>\n` +
    '  </body>\n' +
    '</html>\n'
  );
}
