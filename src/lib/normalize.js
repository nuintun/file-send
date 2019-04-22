/**
 * @module normalize
 * @license MIT
 * @author nuintun
 */

import ms from 'ms';
import * as utils from './utils';
import { join, resolve } from 'path';

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @function normalizeCharset
 * @param {string} charset
 * @returns {string|null}
 */
export function normalizeCharset(charset) {
  return charset && utils.typeOf(charset, 'string') ? charset : null;
}

/**
 * @function normalizeRoot
 * @param {string} root
 * @returns {string}
 */
export function normalizeRoot(root) {
  return utils.unixify(utils.typeOf(root, 'string') ? resolve(root) : CWD);
}

/**
 * @function normalizePath
 * @param {string} path
 * @returns {string|-1}
 */
export function normalizePath(path) {
  path = utils.decodeURI(path);

  return path === -1 ? path : utils.normalize(path);
}

/**
 * @function normalizeRealpath
 * @param {string} root
 * @param {string} path
 * @returns {string|-1}
 */
export function normalizeRealpath(root, path) {
  return path === -1 ? path : utils.unixify(join(root, path));
}

/**
 * @function normalizeList
 * @param {Array} list
 * @returns {Array}
 */
export function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter(item => item && utils.typeOf(item, 'string'));
}

/**
 * @function normalizeAccess
 * @param {string} access
 * @returns {string}
 */
export function normalizeAccess(access) {
  return access === 'ignore' ? access : 'deny';
}

/**
 * @function normalizeMaxAge
 * @param {string|number} maxAge
 * @returns {number}
 */
export function normalizeMaxAge(maxAge) {
  maxAge = utils.typeOf(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

/**
 * @function normalizeBoolean
 * @param {boolean} boolean
 * @param {boolean} def
 * @returns {boolean}
 */
export function normalizeBoolean(boolean, def) {
  return utils.isUndefined(boolean) ? def : Boolean(boolean);
}

/**
 * @function normalizeGlob
 * @param {Object} glob
 * @returns {string}
 */
export function normalizeGlob(glob) {
  glob = glob || {};
  glob.dot = normalizeBoolean(glob.dot, true);

  return glob;
}
