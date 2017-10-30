/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

import * as fs from 'fs';
import * as http from 'http';
import * as Stream from 'stream';
import * as Events from 'events';
import * as mime from 'mime-types';
import * as utils from './lib/utils';

import etag from 'etag';
import fresh from 'fresh';
import destroy from 'destroy';
import encodeUrl from 'encodeurl';
import micromatch from 'micromatch';
import escapeHtml from 'escape-html';
import onFinished from 'on-finished';
import parseRange from 'range-parser';

import {
  through
} from './lib/through';

import {
  series
} from './lib/async';

import {
  normalizeRoot,
  normalizePath,
  normalizeRealpath,
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
export default class FileSend extends Events {
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

    super(options);

    this[middlewares] = [];
    this.stdin = through();
    this.request = request;
    this.method = request.method;
    this.path = normalizePath(path);
    this[headers] = Object.create(null);
    this.root = normalizeRoot(options.root);
    this[glob] = normalizeGlob(options.glob);
    this.index = normalizeList(options.index);
    this.ignore = normalizeList(options.ignore);
    this.maxAge = normalizeMaxAge(options.maxAge);
    this.charset = normalizeCharset(options.charset);
    this.etag = normalizeBoolean(options.etag, true);
    this.realpath = normalizeRealpath(this.root, this.path);
    this.ignoreAccess = normalizeAccess(options.ignoreAccess);
    this.immutable = normalizeBoolean(options.immutable, false);
    this.acceptRanges = normalizeBoolean(options.acceptRanges, true);
    this.cacheControl = normalizeBoolean(options.cacheControl, true);
    this.lastModified = normalizeBoolean(options.lastModified, true);
  }

  use(middleware) {
    if (middleware instanceof Stream) {
      this[middlewares].push(middleware);
    }
  }

  setHeader(name, value) {
    // 0 => name
    // 1 => value
    this[headers][name.toLowerCase()] = [name, value];
  }

  getHeader(name) {
    return this[headers][name.toLowerCase()][1];
  }

  getHeaders() {
    const headerItems = this[headers];
    const result = Object.create(null);

    Object
      .keys(headerItems)
      .forEach((name) => {
        let headerItem = headerItems[name];

        result[headerItem[0]] = headerItem[1];
      });

    return result;
  }

  removeHeader(name) {
    delete this[headers][name.toLowerCase()];
  }

  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  headersSent() {
    this.end('Can\'t set headers after they are sent.');
  }

  status(statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage || http.STATUS_CODES[statusCode];
  }

  error(statusCode, statusMessage) {
    const response = this.response;

    this.status(statusCode, statusMessage);

    statusCode = this.statusCode;
    statusMessage = this.statusMessage;

    const error = new Error(statusMessage);

    error.statusCode = statusCode;

    // Emit if listeners instead of responding
    if (this.hasListeners('error')) {
      this.emit('error', error, (chunk) => {
        if (response.headersSent) {
          return this.headersSent();
        }

        this.writeHeaders();
        this.end(chunk);
      });
    } else {
      if (response.headersSent) {
        return this.headersSent();
      }

      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(statusMessage));
      this.setHeader('Content-Security-Policy', "default-src 'self'");
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this.writeHeaders();
      this.end(statusMessage);
    }
  }

  statError(error) {
    // 404 error
    if (NOT_FOUND.indexOf(error.code) !== -1) {
      return this.error(404);
    }

    this.error(500, error.message);
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

  isPreconditionFailure() {
    const request = this.request;
    const response = this.response;
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

  parseRange(stats) {
    const size = stats.size;
    let contentLength = size;
    let ranges = this.request.headers['range'];

    // Reset ranges
    this.ranges = [];

    // Range support
    if (ranges) {
      // Range fresh
      if (this.isRangeFresh()) {
        // Parse range
        ranges = parseRange(size, ranges, { combine: true });

        // Valid ranges, support multiple ranges
        if (Array.isArray(ranges) && ranges.type === 'bytes') {
          this.status(206);

          // Multiple ranges
          if (ranges.length > 1) {
            // Range boundary
            let boundary = '<' + util.boundaryGenerator() + '>';
            // If user set content-type use user define
            const contentType = this.getHeader('Content-Type') || 'application/octet-stream';

            // Set multipart/byteranges
            this.setHeader('Content-Type', 'multipart/byteranges; boundary=' + boundary);

            // Create boundary and end boundary
            boundary = '\r\n--' + boundary;

            // Closed boundary
            const close = boundary + '--\r\n';

            // Common boundary
            boundary += '\r\nContent-Type: ' + contentType;

            // Reset content-length
            contentLength = 0;

            // Loop ranges
            ranges.forEach((range) => {
              // Range start and end
              const start = range.start;
              const end = range.end;

              // Set fields
              const open = boundary + '\r\nContent-Range: ' + 'bytes ' + start + '-' + end + '/' + size + '\r\n\r\n';

              // Set property
              range.open = open;
              // Compute content-length
              contentLength += end - start + Buffer.byteLength(open) + 1;

              // Cache range
              this.ranges.push(range);
            });

            // The first open boundary remove \r\n
            const open = this.ranges[0].open;

            this.ranges[0].open = open.replace(/^\r\n/, '');
            // The last add closed boundary
            this.ranges[this.ranges.length - 1].close = close;
            // Compute content-length
            contentLength += Buffer.byteLength(close);
          } else {
            const range = ranges[0];
            const start = range.start;
            const end = range.end;

            // Set content-range
            this.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);

            // Cache reange
            this.ranges.push(range);

            // Compute content-length
            contentLength = end - start + 1;
          }
        } else if (ranges === -1) {
          // Set content-range
          this.setHeader('Content-Range', 'bytes */' + size);

          // Unsatisfiable 416
          this.error(416);

          return false;
        }
      }
    }

    // Set content-length
    this.setHeader('Content-Length', contentLength);

    return true;
  }

  dir() {
    // If have event directory listener, use user define
    // emit event directory
    if (this.hasListeners('dir')) {
      this.emit('dir', this.realpath, (chunk) => {
        if (this.response.headersSent) {
          return this.headersSent();
        }

        this.writeHeaders();
        this.end(chunk);
      });
    } else {
      this.error(403);
    }
  }

  redirect(location) {
    location = encodeUrl(location);

    const href = escapeHtml(location);
    const html = 'Redirecting to <a href="' + href + '">' + href + '</a>';

    this.status(301);
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(html));
    this.setHeader('Content-Security-Policy', "default-src 'self'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', location);
    this.writeHeaders();
    this.end(html);
  }

  initHeaders(stats) {
    const response = this.response;

    // Accept-Ranges
    if (this.acceptRanges) {
      // Set Accept-Ranges
      this.setHeader('Accept-Ranges', 'bytes');
    }

    // Content-Type
    if (!(response.getHeader('Content-Type'))) {
      // Get type
      let type = mime.lookup(this.path);

      if (type) {
        let charset = this.charset;

        // Get charset
        charset = charset ? '; charset=' + charset : '';

        // Set Content-Type
        this.setHeader('Content-Type', type + charset);
      }
    }

    // Cache-Control
    if (this.cacheControl && this.maxAge > 0 && !(response.getHeader('Cache-Control'))) {
      let cacheControl = 'public, max-age=' + this.maxAge;

      if (this.immutable) {
        cacheControl += ', immutable';
      }

      // Set Cache-Control
      this.setHeader('Cache-Control', cacheControl);
    }

    // Last-Modified
    if (this.lastModified && !(response.getHeader('Last-Modified'))) {
      // Get mtime utc string
      this.setHeader('Last-Modified', stats.mtime.toUTCString());
    }

    if (this.etag && !(response.getHeader('ETag'))) {
      // Set ETag
      this.setHeader('ETag', etag(stats));
    }
  }

  writeHeaders() {
    const response = this.response;
    const headers = this.getHeaders();

    response.statusCode = this.statusCode;
    response.statusMessage = this.statusMessage;

    Object
      .keys(headers)
      .forEach(function(name) {
        response.setHeader(name, headers[name]);
      });
  }

  end(chunk) {
    if (chunk) {
      return this.stdin.end(chunk);
    }

    this.stdin.end();
  }

  sendIndex() {
    const hasTrailingSlash = this.hasTrailingSlash();
    const path = hasTrailingSlash ? this.path : this.path + '/';

    series(this.index.map(function(index) {
      return path + index;
    }), (path, next) => {
      if (this.isIgnore(path)) {
        return next();
      }

      fs.stat(this.root + path, (error, stats) => {
        if (error || !stats.isFile()) {
          return next();
        }

        this.redirect(utils.posixURI(path));
      });
    }, () => {
      if (hasTrailingSlash) {
        return this.dir();
      }

      this.redirect(path);
    });
  }

  sendFile() {
    const stdin = this.stdin;
    let ranges = this.ranges;
    const response = this.response;

    // Stream error
    const onerror = (error) => {
      // Request already finished
      if (onFinished.isFinished(response)) {
        return stdin.end();
      }

      // Stat error
      this.statError(error);
    };

    // Error handling code-smell
    stdin.on('error', onerror);

    // Format ranges
    ranges = ranges.length ? ranges : [{}];

    // Contat range
    series(ranges, (range, next) => {
      // Request already finished
      if (onFinished.isFinished(response)) {
        return stdin.end();
      }

      // Push open boundary
      range.open && stdin.write(range.open);

      // Create file stream
      const file = fs.createReadStream(this.realpath, range);

      // Error handling code-smell
      file.on('error', function(error) {
        // Call onerror
        onerror(error);
        // Destroy file stream
        destroy(file);
      });

      // File stream end
      file.on('end', function() {
        // Stop pipe stdin
        file.unpipe(stdin);

        // Push close boundary
        range.close && stdin.write(range.close);

        // Destroy file stream
        destroy(file);
      });

      // Next
      file.on('close', next);

      // Pipe stdin
      file.pipe(stdin, { end: false });
    }, () => {
      // End stdin
      this.end();
    });
  }

  bootstrap() {
    const response = this.response;

    // Set status
    this.status(response.statusCode || 200);

    // Path -1 or null byte(s)
    if (this.path === -1 || this.path.indexOf('\0') !== -1) {
      return this.error(400);
    }

    // Malicious path
    if (utils.isOutBound(this.realpath, this.root)) {
      return this.error(403);
    }

    // Is ignore path or file
    if (this.isIgnore(this.path)) {
      switch (this.ignoreAccess) {
        case 'deny':
          return this.error(403);
        case 'ignore':
          return this.error(404);
      }
    }

    // Read file
    fs.stat(this.realpath, (error, stats) => {
      // Stat error
      if (error) {
        return this.statError(error);
      }

      // Is directory
      if (stats.isDirectory()) {
        return this.sendIndex();
      } else if (this.hasTrailingSlash()) {
        // Not a directory but has trailing slash
        return this.error(404);
      }

      // Set headers and parse range
      this.initHeaders(stats);

      // Conditional get support
      if (this.isConditionalGET()) {
        if (this.isPreconditionFailure()) {
          this.status(412);
        } else if (this.isCachable() && this.isFresh()) {
          this.status(304);
        }

        // Remove content-type
        this.removeHeader('Content-Type');
        this.writeHeaders();

        // End with empty content
        return this.end();
      }

      // Head request
      if (this.method === 'HEAD') {
        // Set content-length
        this.setHeader('Content-Length', stats.size);
        this.writeHeaders();

        // End with empty content
        return this.end();
      }

      // Parse range
      if (this.parseRange(stats)) {
        this.writeHeaders();
        // Read file
        this.sendFile();
      }
    });
  }

  pipe(response, options) {
    if (!(response instanceof http.ServerResponse)) {
      throw new TypeError('The param response must be a http response.');
    }

    if (this.response) {
      throw new TypeError('There already have a http response alive.');
    }

    this.response = response;

    if (response.headersSent) {
      this.headersSent();

      return response;
    }

    this.bootstrap();

    if (this[middlewares].length) {
      return this.stdin
        .pipe(utils.pipeline(this[middlewares]))
        .pipe(response, options);
    }

    return this.stdin.pipe(response, options);
  }
}

FileSend.through = through;
