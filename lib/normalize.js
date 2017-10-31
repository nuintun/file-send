import ms from 'ms';
import { join, resolve } from 'path';
import * as utils from './utils';

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @function normalizeCharset
 * @param {string} charset
 */
export function normalizeCharset(charset) {
  return utils.typeIs(charset, 'string') ? charset : null;
}

/**
 * @function normalizeRoot
 * @param {string} root
 */
export function normalizeRoot(root) {
  return utils.posixURI(join(utils.typeIs(root, 'string') ? resolve(root) : CWD));
}

/**
 * @function normalizePath
 * @param {string} path
 */
export function normalizePath(path) {
  path = utils.decodeURI(path);

  return path === -1 ? path : utils.normalize(path);
}

/**
 * @function normalizeRealpath
 * @param {string} root
 * @param {string} path
 */
export function normalizeRealpath(root, path) {
  return path === -1 ? path : utils.posixURI(join(root, path));
}

/**
 * @function normalizeList
 * @param {Array} list
 */
export function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter((item) => {
    return item && utils.typeIs(item, 'string');
  })
}

/**
 * @function normalizeAccess
 * @param {string} access
 */
export function normalizeAccess(access) {
  switch (access) {
    case 'deny':
    case 'ignore':
      return access;
      break;
    default:
      return 'deny';
  }
}

/**
 * @function normalizeMaxAge
 * @param {string|number} maxAge
 */
export function normalizeMaxAge(maxAge) {
  maxAge = utils.typeIs(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

/**
 * @function normalizeBoolean
 * @param {boolean} boolean
 * @param {boolean} def
 */
export function normalizeBoolean(boolean, def) {
  return utils.isUndefined(boolean) ? def : Boolean(boolean);
}

/**
 * @function normalizeGlob
 * @param {Object} glob
 */
export function normalizeGlob(glob) {
  glob = glob || {};
  glob.dot = normalizeBoolean(glob.dot, true);

  return glob;
}
