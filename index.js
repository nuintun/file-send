/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

import * as ms from 'ms';
import * as fs from 'fs';
import * as http from 'http';
import * as etag from 'etag';
import * as fresh from 'fresh';
import * as Stream from 'stream';
import * as destroy from 'destroy';
import * as mime from 'mime-types';
import * as utils from './lib/utils';
import * as encodeUrl from 'encodeurl';
import * as micromatch from 'micromatch';
import * as onFinished from 'on-finished';
import * as escapeHtml from 'escape-html';
import * as parseRange from 'range-parser';

import {
  series
} from './lib/async';

import {
  through
} from './lib/through';

import {
  join,
  resolve
} from 'path';

import {
  normalizeRoot,
  normalizePath,
  normalizeList,
  normalizeBoolean,
  normalizeCharset,
  normalizeAccess,
  normalizeMaxAge,
  normalizeGlob
} from './lib/normalize';

// Headers key symbol
const glob = Symbol('glob');
const headers = Symbol('headers');
const middlewares = Symbol('middlewares');

// File not found status
const NOT_FOUND = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

/**
 * @class FileSend
 */
export default class FileSend extends Stream {
  /**
   * @constructor
   * @param {Request} request
   * @param {String} path
   * @param {Object} options
   */
  constructor(request, path, options) {
    if (!(request instanceof http.IncomingMessage)) {
      throw new TypeError('The param request must be a http request.');
    }

    if (!utils.typeIs(path, 'string')) {
      throw new TypeError('The param path must be a string.');
    }

    super();

    this[headers] = {};
    this[middlewares] = [];
    this.request = request;
    this.method = request.method;
    this.path = normalizePath(path);
    this.root = normalizeRoot(options.root);
    this[glob] = normalizeGlob(options.glob);
    this.index = normalizeList(options.index);
    this.ignore = normalizeList(options.ignore);
    this.maxAge = normalizeMaxAge(options.maxAge);
    this.charset = normalizeCharset(options.charset);
    this.etag = normalizeBoolean(options.etag, true);
    this.ignoreAccess = normalizeAccess(options.ignoreAccess);
    this.immutable = normalizeBoolean(options.immutable, false);
    this.acceptRanges = normalizeBoolean(options.acceptRanges, true);
    this.cacheControl = normalizeBoolean(options.cacheControl, true);
    this.lastModified = normalizeBoolean(options.lastModified, true);
  }

  use(middleware) {
    if (middleware instanceof Stream.Transform) {
      this[middlewares].push(middleware);
    }
  }

  setHeader(name, value) {
    this[headers][name.toLowerCase()] = value;
  }

  getHeader(name) {
    return this[headers][name.toLowerCase()];
  }

  getHeaders() {
    return this[headers];
  }

  removeHeader(name) {
    delete this[headers][name.toLowerCase()];
  }

  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  headersSent(response) {
    response.end('Can\'t set headers after they are sent.');
  }

  status(response, statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage || http.STATUS_CODES[statusCode];

    response.statusCode = this.statusCode;
    response.statusMessage = this.statusMessage;
  }

  error(response, statusCode, statusMessage) {
    this.status(response, statusCode, statusMessage);

    statusCode = this.statusCode;
    statusMessage = this.statusMessage;

    const error = new Error(statusMessage);

    error.statusCode = statusCode;

    // Emit if listeners instead of responding
    if (this.hasListeners('error')) {
      this.emit('error', error, (message) => {
        if (response.headersSent) {
          return this.headersSent(response);
        }

        response.end(message);
      });
    } else {
      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(statusMessage));
      this.setHeader('Content-Security-Policy', "default-src 'self'");
      this.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }

  statError(response, error) {
    // 404 error
    if (NOTFOUND.indexOf(error.code) !== -1) {
      return this.error(response, 404);
    }

    this.error(response, 500, error.message);
  }

  hasTrailingSlash() {
    return this.path[this.path.length - 1] === '/';
  }

  isConditionalGET() {
    const headers = this.request.headers;

    return headers['if-match']
      || headers['if-unmodified-since']
      || headers['if-none-match']
      || headers['if-modified-since'];
  }

  isPreconditionFailure(response) {
    const request = this.request;
    // if-match
    const match = request.headers['if-match'];

    if (match) {
      const etag = response.getHeader('ETag');

      return !etag || (match !== '*' && utils.parseTokenList(match).every(function(match) {
        return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
      }));
    }

    // if-unmodified-since
    const unmodifiedSince = utils.parseHttpDate(request.headers['if-unmodified-since']);

    if (!isNaN(unmodifiedSince)) {
      const lastModified = utils.parseHttpDate(response.getHeader('Last-Modified'));

      return isNaN(lastModified) || lastModified > unmodifiedSince;
    }

    return false;
  }

  isCachable() {
    const statusCode = this.statusCode;

    return statusCode === 304 || (statusCode >= 200 && statusCode < 300);
  }

  isFresh() {
    return fresh(this.request.headers, {
      'etag': this.getHeader('ETag'),
      'last-modified': this.getHeader('Last-Modified')
    });
  }

  isRangeFresh() {
    const ifRange = this.request.headers['if-range'];

    if (!ifRange) {
      return true;
    }

    // if-range as etag
    if (ifRange.indexOf('"') !== -1) {
      const etag = this.getHeader('ETag');

      return Boolean(etag && ifRange.indexOf(etag) !== -1);
    }

    // if-range as modified date
    const lastModified = this.getHeader('Last-Modified');

    return utils.parseHttpDate(lastModified) <= utils.parseHttpDate(ifRange);
  }

  isIgnore(path) {
    return this.ignore.length && micromatch(path, this.ignore, this[glob]).length;
  }

  dir(response, realpath, stats) {
    // If have event directory listener, use user define
    // emit event directory
    if (this.hasListeners('dir')) {
      this.emit('dir', realpath, stats, (message) => {
        if (response.headersSent) {
          return this.headersSent(response);
        }

        response.end(message);
      });
    } else {
      this.error(response, 403);
    }
  }

  redirect(response, location) {
    const message = 'Redirecting to <a href="' + location + '">' + escapeHtml(location) + '</a>';

    this.status(response, 301);
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(message));
    this.setHeader('Content-Security-Policy', "default-src 'self'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', location);

    response.end(message);
  }

  pipe(response, options) {
    if (!response instanceof http.ServerResponse) {
      throw new TypeError('The param response must be a http response.')
    }

    if (response.headersSent) {
      this.headersSent(response);

      return response;
    }

    utils.setHeaders(response, this.getHeaders());

    const streams = [this];

    streams.concat(this[middlewares]);

    streams.push(response);

    return utils.pipeline(streams);
  }
}
