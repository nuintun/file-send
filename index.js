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
import * as symbol from './lib/symbol';
import * as normalize from './lib/normalize';

import etag from 'etag';
import fresh from 'fresh';
import destroy from 'destroy';
import encodeUrl from 'encodeurl';
import micromatch from 'micromatch';
import escapeHtml from 'escape-html';
import parseRange from 'range-parser';

import { series } from './lib/async';
import { through } from './lib/through';

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

    this.path = path;
    this.root = options.root;
    this.index = options.index;
    this.ignore = options.ignore;
    this.maxAge = options.maxAge;
    this.charset = options.charset;
    this.etag = options.etag;
    this.ignoreAccess = options.ignoreAccess;
    this.immutable = options.immutable;
    this.acceptRanges = options.acceptRanges;
    this.cacheControl = options.cacheControl;
    this.lastModified = options.lastModified;

    this[symbol.middlewares] = [];
    this[symbol.request] = request;
    this[symbol.stdin] = through();
    this[symbol.glob] = normalize.normalizeGlob(options.glob);
  }

  /**
   * @property request
   * @method get
   */
  get request() {
    return this[symbol.request];
  }

  /**
   * @property response
   * @method get
   */
  get response() {
    const response = this[symbol.response];

    if (!response) {
      throw new Error('Can\'t get http response before called pipe method.');
    }

    return response;
  }

  /**
   * @property method
   * @method get
   */
  get method() {
    return this.request.method;
  }

  /**
   * @property path
   * @method set
   */
  set path(path) {
    this[symbol.path] = normalize.normalizePath(path);
  }

  /**
   * @property path
   * @method get
   */
  get path() {
    return this[symbol.path];
  }

  /**
   * @property root
   * @method set
   */
  set root(root) {
    this[symbol.root] = normalize.normalizeRoot(root);
  }

  /**
   * @property root
   * @method get
   */
  get root() {
    return this[symbol.root];
  }

  /**
   * @property realpath
   * @method get
   */
  get realpath() {
    return normalize.normalizeRealpath(this.root, this.path);
  }

  /**
   * @property index
   * @method set
   */
  set index(index) {
    this[symbol.index] = normalize.normalizeList(index);
  }

  /**
   * @property index
   * @method get
   */
  get index() {
    return this[symbol.index];
  }

  /**
   * @property ignore
   * @method set
   */
  set ignore(ignore) {
    this[symbol.ignore] = normalize.normalizeList(ignore);
  }

  /**
   * @property ignore
   * @method get
   */
  get ignore() {
    return this[symbol.ignore];
  }

  /**
   * @property ignoreAccess
   * @method set
   */
  set ignoreAccess(ignoreAccess) {
    this[symbol.ignoreAccess] = normalize.normalizeAccess(ignoreAccess);
  }

  /**
   * @property ignoreAccess
   * @method get
   */
  get ignoreAccess() {
    return this[symbol.ignoreAccess];
  }

  /**
   * @property maxAge
   * @method set
   */
  set maxAge(maxAge) {
    this[symbol.maxAge] = normalize.normalizeMaxAge(maxAge);
  }

  /**
   * @property maxAge
   * @method get
   */
  get maxAge() {
    return this[symbol.maxAge];
  }

  /**
   * @property charset
   * @method set
   */
  set charset(charset) {
    this[symbol.charset] = normalize.normalizeCharset(charset);
  }

  /**
   * @property charset
   * @method get
   */
  get charset() {
    this[symbol.charset];
  }

  /**
   * @property etag
   * @method set
   */
  set etag(etag) {
    this[symbol.etag] = normalize.normalizeBoolean(etag, true);
  }

  /**
   * @property etag
   * @method get
   */
  get etag() {
    return this[symbol.etag];
  }

  /**
   * @property immutable
   * @method set
   */
  set immutable(immutable) {
    this[symbol.immutable] = normalize.normalizeBoolean(immutable, false);
  }

  /**
   * @property immutable
   * @method get
   */
  get immutable() {
    return this[symbol.immutable];
  }

  /**
   * @property acceptRanges
   * @method set
   */
  set acceptRanges(acceptRanges) {
    this[symbol.acceptRanges] = normalize.normalizeBoolean(acceptRanges, true);
  }

  /**
   * @property acceptRanges
   * @method get
   */
  get acceptRanges() {
    return this[symbol.acceptRanges];
  }

  /**
   * @property cacheControl
   * @method set
   */
  set cacheControl(cacheControl) {
    this[symbol.cacheControl] = normalize.normalizeBoolean(cacheControl, true);
  }

  /**
   * @property cacheControl
   * @method get
   */
  get cacheControl() {
    return this[symbol.cacheControl];
  }

  /**
   * @property lastModified
   * @method set
   */
  set lastModified(lastModified) {
    this[symbol.lastModified] = normalize.normalizeBoolean(lastModified, true);
  }

  /**
   * @property lastModified
   * @method get
   */
  get lastModified() {
    return this[symbol.lastModified];
  }

  /**
   * @property statusCode
   * @method set
   */
  set statusCode(statusCode) {
    this.response.statusCode = statusCode;
  }

  /**
   * @property statusCode
   * @method get
   */
  get statusCode() {
    return this.response.statusCode;
  }

  /**
   * @property statusMessage
   * @method set
   */
  set statusMessage(statusMessage) {
    this.response.statusMessage = statusMessage || http.STATUS_CODES[this.statusCode];
  }

  /**
   * @property statusMessage
   * @method get
   */
  get statusMessage() {
    return this.response.statusMessage;
  }

  /**
   * @method use
   * @param {Stream} middleware
   * @public
   */
  use(middleware) {
    if (middleware instanceof Stream) {
      this[symbol.middlewares].push(middleware);
    }

    return this;
  }

  /**
   * @method setHeader
   * @param {string} name
   * @param {string} value
   * @public
   */
  setHeader(name, value) {
    this.response.setHeader(name, value);
  }

  /**
   * @method getHeader
   * @param {string} name
   * @public
   */
  getHeader(name) {
    return this.response.getHeader(name);
  }

  /**
   * @method getHeaders
   * @public
   */
  getHeaders() {
    return this.response.getHeaders();
  }

  /**
   * @method removeHeader
   * @param {string} name
   * @public
   */
  removeHeader(name) {
    this.response.removeHeader(name);
  }

  /**
   * @method removeHeaders
   * @public
   */
  hasHeader(name) {
    const response = this.response;

    if (response.hasHeader) {
      return response.hasHeader(name);
    }

    return response.getHeader(name) !== utils.undef;
  }

  /**
   * @method hasListeners
   * @param {string} event
   * @public
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * @method status
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  status(statusCode, statusMessage) {
    this.statusCode = statusCode;
    this.statusMessage = statusMessage;
  }

  /**
   * @method redirect
   * @param {string} location
   * @public
   */
  redirect(location) {
    const href = encodeUrl(location);
    const html = `Redirecting to <a href="${ href }">${ escapeHtml(location) }</a>`;

    this.status(301);
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Content-Type', 'text/html; charset=UTF-8');
    this.setHeader('Content-Length', Buffer.byteLength(html));
    this.setHeader('Content-Security-Policy', "default-src 'self'");
    this.setHeader('X-Content-Type-Options', 'nosniff');
    this.setHeader('Location', href);
    this[symbol.responseEnd](html);
  }

  /**
   * @method pipe
   * @param {Response} response
   * @param {Object} options
   * @public
   */
  pipe(response, options) {
    if (this[symbol.response]) {
      throw new TypeError('There already have a http response alive.');
    }

    if (!(response instanceof http.ServerResponse)) {
      throw new TypeError('The param response must be a http response.');
    }

    // Set response
    this[symbol.response] = response;

    // Headers already sent
    if (response.headersSent) {
      this[symbol.headersSent]();

      return response;
    }

    // Listening error event
    response.once('error', (error) => {
      this[symbol.statError](error);
    });

    // Bootstrap
    this[symbol.bootstrap]();

    // Pipeline
    const streams = [this[symbol.stdin]].concat(this[symbol.middlewares]);

    streams.push(response);

    return utils.pipeline(streams);
  }

  /**
   * @method end
   * @param {string} chunk
   * @param {string} encoding
   * @param {Function} callback
   * @public
   */
  end(chunk, encoding, callback) {
    if (chunk) {
      this[symbol.stdin].end(chunk, encoding, callback);
    } else {
      this[symbol.stdin].end();
    }
  }

  /**
   * @method headersSent
   * @private
   */
  [symbol.headersSent]() {
    this[symbol.responseEnd]('Can\'t set headers after they are sent.');
  }

  /**
   * @method error
   * @param {number} statusCode
   * @param {string} statusMessage
   * @public
   */
  [symbol.error](statusCode, statusMessage) {
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
          return this[symbol.headersSent]();
        }

        this[symbol.responseEnd](chunk);
      });
    } else {
      if (response.headersSent) {
        return this[symbol.headersSent]();
      }

      // Error document
      const document = utils.createErrorDocument(statusCode, statusMessage);

      // Set headers
      this.setHeader('Cache-Control', 'private');
      this.setHeader('Content-Type', 'text/html; charset=UTF-8');
      this.setHeader('Content-Length', Buffer.byteLength(document));
      this.setHeader('Content-Security-Policy', `default-src 'self' 'unsafe-inline'`);
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this[symbol.responseEnd](document);
    }
  }

  /**
   * @method statError
   * @param {Error} error
   * @private
   */
  [symbol.statError](error) {
    // 404 error
    if (NOT_FOUND.indexOf(error.code) !== -1) {
      return this[symbol.error](404);
    }

    this[symbol.error](500, error.message);
  }

  /**
   * @method hasTrailingSlash
   * @private
   */
  [symbol.hasTrailingSlash]() {
    return this.path[this.path.length - 1] === '/';
  }

  /**
   * @method isConditionalGET
   * @private
   */
  [symbol.isConditionalGET]() {
    const headers = this.request.headers;

    return headers['if-match']
      || headers['if-unmodified-since']
      || headers['if-none-match']
      || headers['if-modified-since'];
  }

  /**
   * @method isPreconditionFailure
   * @private
   */
  [symbol.isPreconditionFailure]() {
    const request = this.request;
    // if-match
    const match = request.headers['if-match'];

    if (match) {
      const etag = this.getHeader('ETag');

      return !etag || (match !== '*' && utils.parseTokenList(match).every((match) => {
        return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
      }));
    }

    // if-unmodified-since
    const unmodifiedSince = utils.parseHttpDate(request.headers['if-unmodified-since']);

    if (!isNaN(unmodifiedSince)) {
      const lastModified = utils.parseHttpDate(this.getHeader('Last-Modified'));

      return isNaN(lastModified) || lastModified > unmodifiedSince;
    }

    return false;
  }

  /**
   * @method isCachable
   * @private
   */
  [symbol.isCachable]() {
    const statusCode = this.statusCode;

    return statusCode === 304 || (statusCode >= 200 && statusCode < 300);
  }

  /**
   * @method isFresh
   * @private
   */
  [symbol.isFresh]() {
    return fresh(this.request.headers, {
      'etag': this.getHeader('ETag'),
      'last-modified': this.getHeader('Last-Modified')
    });
  }

  /**
   * @method isRangeFresh
   * @private
   */
  [symbol.isRangeFresh]() {
    const ifRange = this.request.headers['if-range'];

    if (!ifRange) {
      return true;
    }

    // If-Range as etag
    if (ifRange.indexOf('"') !== -1) {
      const etag = this.getHeader('ETag');

      return Boolean(etag && ifRange.indexOf(etag) !== -1);
    }

    // If-Range as modified date
    const lastModified = this.getHeader('Last-Modified');

    return utils.parseHttpDate(lastModified) <= utils.parseHttpDate(ifRange);
  }

  /**
   * @method isIgnore
   * @param {string} path
   * @private
   */
  [symbol.isIgnore](path) {
    return this.ignore.length && micromatch(path, this.ignore, this[symbol.glob]).length;
  }

  /**
   * @method parseRange
   * @param {Stats} stats
   * @private
   */
  [symbol.parseRange](stats) {
    // Reset ranges
    this.ranges = [];

    // Get size
    const size = stats.size;
    let contentLength = size;

    // Range support
    if (this.acceptRanges) {
      let ranges = this.request.headers['range'];

      // Range fresh
      if (ranges && this[symbol.isRangeFresh]()) {
        // Parse range
        ranges = parseRange(size, ranges, { combine: true });

        // Valid ranges, support multiple ranges
        if (Array.isArray(ranges) && ranges.type === 'bytes') {
          this.status(206);

          // Multiple ranges
          if (ranges.length > 1) {
            // Range boundary
            let boundary = `<${ utils.boundaryGenerator() }>`;
            // If user set content-type use user define
            const contentType = this.getHeader('Content-Type') || 'application/octet-stream';

            // Set multipart/byteranges
            this.setHeader('Content-Type', `multipart/byteranges; boundary=${ boundary }`);

            // Create boundary and end boundary
            boundary = `\r\n--${ boundary }`;

            // Closed boundary
            const close = `${ boundary }--\r\n`;

            // Common boundary
            boundary += `\r\nContent-Type: ${ contentType }`;

            // Reset content-length
            contentLength = 0;

            // Map ranges
            ranges.forEach((range) => {
              // Range start and end
              const start = range.start;
              const end = range.end;
              // Set fields
              const open = `${ boundary }\r\nContent-Range: bytes ${ start }-${ end }/${ size }\r\n\r\n`;

              // Set property
              range.open = open;
              // Compute content-length
              contentLength += end - start + Buffer.byteLength(open) + 1;

              // Cache range
              this.ranges.push(range);
            });

            // The first open boundary remove \r\n
            this.ranges[0].open = this.ranges[0].open.replace(/^\r\n/, '');
            // The last add closed boundary
            this.ranges[this.ranges.length - 1].close = close;

            // Compute content-length
            contentLength += Buffer.byteLength(close);
          } else {
            const range = ranges[0];
            const start = range.start;
            const end = range.end;

            // Set content-range
            this.setHeader('Content-Range', `bytes ${ start }-${ end }/${ size }`);

            // Cache range
            this.ranges.push(range);

            // Compute content-length
            contentLength = end - start + 1;
          }
        } else if (ranges === -1) {
          // Set content-range
          this.setHeader('Content-Range', `bytes */${ size }`);
          // Unsatisfiable 416
          this[symbol.error](416);

          return false;
        }
      }
    }

    // Set content-length
    this.setHeader('Content-Length', contentLength);

    return true;
  }

  /**
   * @method dir
   * @private
   */
  [symbol.dir]() {
    // If have event directory listener, use user define
    // emit event directory
    if (this.hasListeners('dir')) {
      this.emit('dir', this.realpath, (chunk) => {
        if (this.response.headersSent) {
          return this[symbol.headersSent]();
        }

        this[symbol.responseEnd](chunk);
      });
    } else {
      this[symbol.error](403);
    }
  }

  /**
   * @method initHeaders
   * @param {Stats} stats
   * @private
   */
  [symbol.initHeaders](stats) {
    const response = this.response;

    // Accept-Ranges
    if (this.acceptRanges) {
      // Set Accept-Ranges
      this.setHeader('Accept-Ranges', 'bytes');
    }

    // Content-Type
    if (!(this.hasHeader('Content-Type'))) {
      // Get type
      let type = mime.lookup(this.path);

      if (type) {
        let charset = this.charset;

        // Get charset
        charset = charset ? `; charset=${ charset }` : '';

        // Set Content-Type
        this.setHeader('Content-Type', type + charset);
      }
    }

    // Cache-Control
    if (this.cacheControl && this.maxAge > 0 && !(this.hasHeader('Cache-Control'))) {
      let cacheControl = `public, max-age=${ this.maxAge }`;

      if (this.immutable) {
        cacheControl += ', immutable';
      }

      // Set Cache-Control
      this.setHeader('Cache-Control', cacheControl);
    }

    // Last-Modified
    if (this.lastModified && !(this.hasHeader('Last-Modified'))) {
      // Get mtime utc string
      this.setHeader('Last-Modified', stats.mtime.toUTCString());
    }

    if (this.etag && !(this.hasHeader('ETag'))) {
      // Set ETag
      this.setHeader('ETag', etag(stats));
    }
  }

  /**
   * @method responseEnd
   * @param {string} chunk
   * @param {string} chunk
   * @param {Function} chunk
   * @private
   */
  [symbol.responseEnd](chunk, encoding, callback) {
    const response = this.response;

    if (response) {
      if (chunk) {
        response.end(chunk, encoding, callback);
      } else {
        response.end();
      }
    }
  }

  /**
   * @method sendIndex
   * @private
   */
  [symbol.sendIndex]() {
    const hasTrailingSlash = this[symbol.hasTrailingSlash]();
    const path = hasTrailingSlash ? this.path : `${ this.path }/`;

    series(this.index.map((index) => {
      return path + index;
    }), (path, next) => {
      if (this[symbol.isIgnore](path)) {
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
        return this[symbol.dir]();
      }

      this.redirect(path);
    });
  }

  /**
   * @method sendFile
   * @private
   */
  [symbol.sendFile]() {
    let ranges = this.ranges;
    const response = this.response;
    const realpath = this.realpath;
    const stdin = this[symbol.stdin];

    // Format ranges
    ranges = ranges.length ? ranges : [{}];

    // Contat range
    series(ranges, (range, next) => {
      // Push open boundary
      range.open && stdin.write(range.open);

      // Create file stream
      const file = fs.createReadStream(realpath, range);

      // Error handling code-smell
      file.on('error', (error) => {
        // Destroy file stream
        destroy(file);

        // Emit stdin error
        stdin.emit('error', error);
      });

      // File stream end
      file.on('end', () => {
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

  /**
   * @method bootstrap
   * @private
   */
  [symbol.bootstrap]() {
    const response = this.response;
    const realpath = this.realpath;

    // Set status
    this.status(response.statusCode || 200);

    // Path -1 or null byte(s)
    if (this.path === -1 || this.path.indexOf('\0') !== -1) {
      return this[symbol.error](400);
    }

    // Malicious path
    if (utils.isOutBound(realpath, this.root)) {
      return this[symbol.error](403);
    }

    // Is ignore path or file
    if (this[symbol.isIgnore](this.path)) {
      switch (this.ignoreAccess) {
        case 'deny':
          return this[symbol.error](403);
        case 'ignore':
          return this[symbol.error](404);
      }
    }

    // Read file
    fs.stat(realpath, (error, stats) => {
      // Stat error
      if (error) {
        return this[symbol.statError](error);
      }

      // Is directory
      if (stats.isDirectory()) {
        return this[symbol.sendIndex]();
      } else if (this[symbol.hasTrailingSlash]()) {
        // Not a directory but has trailing slash
        return this[symbol.error](404);
      }

      // Set headers and parse range
      this[symbol.initHeaders](stats);

      // Conditional get support
      if (this[symbol.isConditionalGET]()) {
        const responseEnd = () => {
          // Remove content-type
          this.removeHeader('Content-Type');

          // End with empty content
          this[symbol.responseEnd]();
        }

        if (this[symbol.isPreconditionFailure]()) {
          this.status(412);

          return responseEnd();

        } else if (this[symbol.isCachable] && this[symbol.isFresh]()) {
          this.status(304);

          return responseEnd();
        }
      }

      // Head request
      if (this.method === 'HEAD') {
        // Set content-length
        this.setHeader('Content-Length', stats.size);

        // End with empty content
        return this[symbol.responseEnd]();
      }

      // Parse range
      if (this[symbol.parseRange](stats)) {
        // Emit file event
        if (this.hasListeners('file')) {
          this.emit('file', realpath, stats);
        }

        // Read file
        this[symbol.sendFile]();
      }
    });
  }

}

// Exports mime
FileSend.mime = mime;
