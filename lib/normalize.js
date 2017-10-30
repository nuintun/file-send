import ms from 'ms';
import { join, resolve } from 'path';
import * as utils from './utils';

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAX_MAX_AGE = 60 * 60 * 24 * 365;

export function normalizeCharset(charset) {
  return utils.typeIs(charset, 'string') ? charset : null;
}

export function normalizeRoot(root) {
  return utils.posixURI(utils.typeIs(root, 'string') ? resolve(root) : CWD);
}

export function normalizePath(path) {
  path = utils.decodeURI(path);

  return path === -1 ? path : utils.normalize(path);
}

export function normalizeRealpath(root, path) {
  return path === -1 ? path : utils.posixURI(join(root, path));
}

export function normalizeList(list) {
  list = Array.isArray(list) ? list : [list];

  return list.filter(function(item) {
    return item && utils.typeIs(item, 'string');
  })
}

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

export function normalizeMaxAge(maxAge) {
  maxAge = utils.typeIs(maxAge, 'string') ? ms(maxAge) / 1000 : Number(maxAge);
  maxAge = !isNaN(maxAge) ? Math.min(Math.max(0, maxAge), MAX_MAX_AGE) : 0;

  return Math.floor(maxAge);
}

export function normalizeBoolean(boolean, def) {
  return utils.isUndefined(boolean) ? def : Boolean(boolean);
}

export function normalizeGlob(glob) {
  glob = glob || {};
  glob.dot = normalizeBoolean(glob.dot, true);

  return glob;
}
