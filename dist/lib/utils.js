"use strict";
/**
 * @module utils
 * @license MIT
 * @version 2017/10/24
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.typeIs = typeIs;
/**
 * @function isOutBound
 * @description Test path is out of bound of base
 * @param {string} path
 * @param {string} root
 * @returns {boolean}
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
exports.isOutBound = isOutBound;
/**
 * @function normalize
 * @description Normalize path
 * @param {string} path
 * @returns {string}
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
        src = src.replace(DOUBLE_DOT_RE, function (matched, dirname) {
            return dirname === '..' ? matched : '';
        });
        // Break
        if (path === src) {
            break;
        }
        else {
            path = src;
        }
    } while (true);
    // Get path
    return path;
}
exports.normalize = normalize;
/**
 * @function posixURI
 * @description Format URI to posix style
 * @param {string} path
 * @returns {string}
 */
function posixURI(path) {
    return path.replace(/\\/g, '/');
}
exports.posixURI = posixURI;
/**
 * @function decodeURI
 * @description Decode URI component.
 * @param {string} uri
 * @returns {string|-1}
 */
function decodeURI(uri) {
    try {
        return decodeURIComponent(uri);
    }
    catch (err) {
        return -1;
    }
}
exports.decodeURI = decodeURI;
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
exports.boundaryGenerator = boundaryGenerator;
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
exports.parseHttpDate = parseHttpDate;
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
exports.apply = apply;
