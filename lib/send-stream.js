/**
 * file-send
 * https://nuintun.github.io/file-send
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

var join, // Path.join
  extname, // Path.extname
  listenerCount, // EventEmitter.listenerCount
  fs = require('fs'), // File system
  http = require('http'), // Http
  path = require('path'), // Path
  mime = require('mime'), // MIME
  etag = require('etag'), // ETag
  fresh = require('fresh'), // Fresh
  util = require('./util'), // Util
  Stream = require('stream'), // Stream
  parseUrl = require('url').parse, // Url
  destroy = require('destroy'), // Destroy stream
  debug = require('./debug'), // Debug
  debugTimestamp = debug.timestamp(), // Debug timestamp
  onFinished = require('on-finished'), // On response finished
  escapeHtml = require('escape-html'), // Escape html
  parseRange = require('range-parser'), // Range parser
  EventEmitter = require('events').EventEmitter, // EventEmitter
  debugRequest = debug('Request ', debugTimestamp), // Debug request
  debugResponse = debug('Response', debugTimestamp); // Debug response

// Cache method and property
join = path.join;
extname = path.extname;
listenerCount = EventEmitter.listenerCount;

/**
 * SendStream
 * @param {Object} requset
 * @param {String} response
 * @param {Object} options
 * @return {SendStream}
 * @api private
 */
function SendStream(requset, response, options){
  var url, pathname;

  // Reset debug timestamp
  debugTimestamp.reset();

  // Format url
  url = util.decode(requset.url);
  url = url === -1 ? url : util.httpPath(url);
  util.readonlyProperty(this, 'url', url);

  // Path name no query
  pathname = url === -1 ? '' : util.decode(parseUrl(url).pathname);
  util.readonlyProperty(this, 'pathname', pathname);

  // Path has trailing slash
  util.privateProperty(this, 'hasTrailingSlash', pathname.slice(-1) === '/');

  // Debug infomation
  debugRequest('Url: %s'.green.bold, url);

  // Requset
  util.readonlyProperty(this, 'requset', requset);

  // Response
  util.readonlyProperty(this, 'response', response);

  // Root
  util.privateProperty(this, 'root', options.root);

  // Etag
  util.privateProperty(this, 'etag', options.etag);

  // Dot files access, The value can be "allow", "deny", or "ignore"
  util.privateProperty(this, 'dotFiles', options.dotFiles);

  // Extensions
  util.privateProperty(this, 'extensions', options.extensions);

  // Default document
  util.privateProperty(this, 'index', options.index);

  // Last modified
  util.privateProperty(this, 'lastModified', options.lastModified);

  // Max age
  util.privateProperty(this, 'maxAge', options.maxAge);

  // Return instance
  return this;
}

/**
 * Inherits from `EventEmitter.prototype`
 */
SendStream.prototype.__proto__ = EventEmitter.prototype;

/**
 * Emit error with status
 * @param {Number} status
 * @param {Error=} err
 * @api public
 */
SendStream.prototype.error = function (status, err){
  var res = this.response,
    msg = http.STATUS_CODES[status];

  // Format err
  err = util.isType(err, 'error') ? err : new Error(msg);
  err.status = status;

  // Header already sent
  if (res.headersSent) {
    res.end(JSON.stringify({
      status: status,
      message: err.message
    }));
  } else {
    // Set status code
    res.statusCode = status;

    // Emit if listeners instead of responding
    if (listenerCount(this, 'error') > 0) {
      return this.emit('error', err);
    }

    // Wipe all existing headers
    res._headers = null;

    // Close response
    res.end(msg);
  }
};

/**
 * Check if this is a conditional GET request
 * @return {Boolean}
 * @api private
 */
SendStream.prototype.isConditionalGET = function (){
  return this.requset.headers['if-none-match']
    || this.requset.headers['if-modified-since'];
};

/**
 * Strip Content-* header fields
 * @api private
 */
SendStream.prototype.removeContentHeaderFields = function (){
  var res = this.response;

  // Remove header
  Object.keys(res._headers).forEach(function (field){
    if (0 === field.indexOf('content')) {
      res.removeHeader(field);
    }
  });
};

/**
 * Respond with 304 not modified
 * @api private
 */
SendStream.prototype.notModified = function (){
  var res = this.response;

  // Debug information
  debugResponse('Not modified');

  // Remove content header fields
  this.removeContentHeaderFields();
  // Set status code
  res.statusCode = 304;
  // Close response
  res.end();
};

/**
 * Raise error that headers already sent
 * @api private
 */
SendStream.prototype.headersAlreadySent = function headersAlreadySent(){
  var err = new Error('Can\'t set headers after they are sent');

  // Debug information
  debugResponse('Headers already sent');

  // 500 error
  this.error(500, err);
};

/**
 * Check if the request is cacheable, aka responded with 2xx or 304 (see RFC 2616 section 14.2{5,6})
 * @return {Boolean}
 * @api private
 */
SendStream.prototype.isCachable = function (){
  var res = this.response;

  // Return cache status
  return (res.statusCode >= 200 && res.statusCode < 300) || 304 === res.statusCode;
};

/**
 * Handle stat() error
 * @param {Error} err
 * @api private
 */
SendStream.prototype.onStatError = function (err){
  var notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

  // 404 error
  if (~notfound.indexOf(err.code)) {
    return this.error(404);
  }

  // 500 error
  this.error(500, err);
};

/**
 * Check if the cache is fresh
 * @return {Boolean}
 * @api private
 */
SendStream.prototype.isFresh = function (){
  return fresh(this.requset.headers, this.response._headers);
};

/**
 * Check if the range is fresh
 * @param {Object} stat
 * @return {Boolean}
 * @api private
 */
SendStream.prototype.isRangeFresh = function isRangeFresh(stat){
  var etagVal, lastModified,
    ifRange = this.requset.headers['if-range'];

  // Not range request
  if (!ifRange) return true;

  // ETag
  etagVal = this.response._headers['etag'] || '"' + etag(stat, {
    weak: false // Disable weak etag
  }) + '"';

  // Last modified
  lastModified = this.response._headers['last-modified'] || stat.mtime.toUTCString();

  // Is range fresh
  return ifRange.trim() === etagVal || Date.parse(ifRange) === Date.parse(lastModified);
};

/**
 * Redirect to path
 * @param {String} url
 * @api public
 */
SendStream.prototype.redirect = function (url){
  var res = this.response;

  // Headers already send
  if (res.headersSent) return;

  // Debug infomation
  debugResponse('Redirect: %s', url);

  // Wipe all existing headers
  res._headers = null;

  // Response
  res.statusCode = 301;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Location', url);

  // Escape url
  url = escapeHtml(url);

  // Send data
  res.end('Redirecting to <a href="' + url + '">' + url + '</a>');
};

/**
 * Directory
 * @param {String} path
 * @param {Object} stat
 * @api private
 */
SendStream.prototype.directory = function (path, stat){
  // If have event directory listener, use user define
  if (listenerCount(this, 'directory') > 0) {
    // Emit event directory
    return this.emit('directory', path, stat);
  }

  // Wipe all existing headers
  this.response._headers = null;

  // Default not allow view directory
  this.error(403);
};

/**
 * Transfer stream
 * @return {Stream}
 * @api public
 */
SendStream.prototype.transfer = function (){
  var path, dotFiles,
    req = this.requset,
    res = this.response,
    root = this.root,
    url = this.url; // Decode the url

  // Requset method not support
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    this.error(405);

    // Return response
    return res;
  }

  // Path error or null byte(s)
  if (url === -1 || url.indexOf('\0') !== -1) {
    this.error(400);

    // Return response
    return res;
  }

  // Join and normalize from optional root dir
  path = util.httpPath(join(root, this.pathname));

  // Dotfile handling
  if (util.containsDotFile(path)) {
    dotFiles = this.dotFiles;

    // Debug infomation
    debugResponse('Dot file: %s %s', path, dotFiles);

    // Dot files access
    switch (dotFiles) {
      case 'allow':
        break;
      case 'deny':
        this.error(403);

        // Return response
        return res;
      case 'ignore':
      default:
        this.error(404);

        // Return response
        return res;
    }
  }

  // Index file support
  if (this.index.length && this.hasTrailingSlash) {
    this.sendIndex(path);

    // Return response
    return res;
  }

  // Send files
  this.sendFile(path);

  // Return response
  return res;
};

/**
 * Transfer file
 * @param {String} path
 * @param {Object} stat
 * @api public
 */
SendStream.prototype.send = function (path, stat){
  var req = this.requset,
    res = this.response;

  // File ranges
  //this.ranges = [];
  util.privateProperty(this, 'ranges', []);

  if (res.headersSent) {
    // Impossible to send now
    return this.headersAlreadySent();
  }

  // Debug infomation
  debugResponse('Send: %s', path);

  // Set content-type
  this.setContentType(path);

  // Set header fields
  this.setHeader(path, stat);

  // Conditional GET support
  if (this.isConditionalGET()
    && this.isCachable()
    && this.isFresh()) {
    // Emit end event
    listenerCount(this, 'end') > 0 && this.emit('end');
    // Not modified
    return this.notModified();
  }

  // Parse range
  this.parseRange(stat);

  // HEAD support
  if (req.method === 'HEAD') {
    // Emit end event
    listenerCount(this, 'end') > 0 && this.emit('end');

    // End response
    return res.end();
  }

  // Send stream
  this.stream(path);
};

/**
 * Transfer `path`
 * @param {Object} stat
 * @api private
 */
SendStream.prototype.parseRange = function (stat){
  var start, end,
    boundary,
    endBoundary,
    rangeFresh,
    contentType,
    self = this,
    size = stat.size,
    res = self.response,
    ranges = self.requset.headers.range;

  // Range support
  if (ranges) {
    // Range fresh
    rangeFresh = this.isRangeFresh(stat);

    if (rangeFresh) {
      // Parse range
      ranges = parseRange(size, ranges);

      // Valid ranges, support multiple ranges
      if (util.isType(ranges, 'array') && ranges.type === 'bytes') {
        // Content-Range
        res.statusCode = 206;

        // Multiple ranges
        if (ranges.length > 1) {
          // Reset content length
          size = 0;
          // Range boundary
          boundary = util.boundaryGenerator();

          // If user set Content-Type use user define
          contentType = res.getHeader('Content-Type') || 'application/octet-stream';

          // Debug infomation
          debugResponse('Multiple ranges');
          debugResponse('Content-Type Rewrite: multipart/byteranges; boundary=<%s>', boundary);
          // Set multipart/byteranges
          res.setHeader('Content-Type', 'multipart/byteranges; boundary=<' + boundary + '>');

          // Create boundary and end boundary
          boundary = '--<' + boundary + '>';
          endBoundary = '\r\n' + boundary + '--';
          boundary += '\r\nContent-Type: ' + contentType;

          // Loop ranges
          ranges.forEach(function (range, i){
            var _boundary;

            // Range start and end
            start = range.start;
            end = range.end;

            // Set fields
            _boundary = (i == 0 ? '' : '\r\n') + boundary
            + '\r\nContent-Range: ' + 'bytes ' + start
            + '-' + end + '/' + stat.size + '\r\n\r\n';

            // Set property
            range.boundary = _boundary;
            size += end - start + Buffer.byteLength(_boundary) + 1;

            // Cache range
            self.ranges.push(range);
          });

          // The last add endBoundary
          self.ranges[self.ranges.length - 1].endBoundary = endBoundary;
          size += Buffer.byteLength(endBoundary);
        } else {
          this.ranges.push(ranges[0]);
          start = ranges[0].start;
          end = ranges[0].end;

          // Debug infomation
          debugResponse('Content-Range: bytes %s-%s/%s', start, end, size);
          // Set Content-Range
          res.setHeader(
            'Content-Range',
            'bytes ' + start + '-' + end + '/' + size
          );

          // Reset content length
          size = end - start + 1;
        }
      } else if (ranges === -1) {
        // Debug infomation
        debugResponse('Range unsatisfiable');
        debugResponse('Content-Range: bytes */%s', size);
        // Set Content-Range
        res.setHeader('Content-Range', 'bytes */' + size);

        // Unsatisfiable 416
        return this.error(416);
      }

      // Free ranges
      ranges = null;
    } else {
      // Debug infomation
      debugResponse('Range stale');
    }
  }

  // Debug infomation
  debugResponse('Content-Length: %s', size);
  // Set Content-length
  res.setHeader('Content-Length', size);
};

/**
 * Transfer file for path
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendFile = function sendFile(path){
  var i = 0,
    pathStat,
    self = this,
    extensions = self.extensions,
    lenExt = extensions.length;

  // Send helper
  function send(stat){
    if (stat.isDirectory()) {
      if (self.hasTrailingSlash) {
        return self.directory(path, stat);
      } else {
        return self.redirect(self.url + '/');
      }
    }

    // Emit file event
    listenerCount(self, 'file') > 0 && self.emit('file', path, stat);

    // Send
    self.send(path, stat);
  }

  // Stat
  fs.stat(path, function (err, stat){
    // Debug infomation
    debugResponse('Read: %s %s', path, err ? err.code : 'OK');

    // Cache stat
    pathStat = stat;

    // Check extensions
    if (lenExt > 0
      && !self.hasTrailingSlash
      && extensions.indexOf(extname(path).slice(1)) === -1) {
      return next(err);
    }

    // Error
    if (err) {
      return self.onStatError(err);
    }

    // Send
    send(stat);
  });

  // Loop extensions
  function next(err){
    var _path;

    // Loop end
    if (i >= lenExt) {
      if (pathStat) {
        return send(pathStat);
      } else {
        return err
          ? self.onStatError(err)
          : self.error(404);
      }
    }

    // Add extensions
    _path = path + '.' + extensions[i++];

    // Stat
    fs.stat(_path, function (err, stat){
      // Debug infomation
      debugResponse('Read: %s %s', _path, err ? err.code : 'OK');

      // Error
      if (err) {
        return next(err);
      }

      // Is directory
      if (stat.isDirectory()) {
        return next();
      }

      // Emit file event
      listenerCount(self, 'file') > 0 && self.emit('file', _path, stat);

      // Send
      self.send(_path, stat);
    });
  }
};

/**
 * Transfer index for path
 * @param {String} path
 * @api private
 */
SendStream.prototype.sendIndex = function sendIndex(path){
  var i = 0,
    pathStat,
    self = this,
    index = self.index,
    lenIndex = index.length;

  // Stat
  fs.stat(path, function (err, stat){
    // Debug infomation
    debugResponse('Read: %s %s', path, err ? err.code : 'OK');

    // Error
    if (err) {
      return self.onStatError(err);
    }

    // Cache stat
    pathStat = stat;

    // Loop index
    next(err);
  });

  // Loop index
  function next(){
    var _path,
      _index;

    // Loop end
    if (i >= lenIndex) {
      return self.directory(path, pathStat);
    }

    // Get default document
    _index = index[i++];

    // If default document is dot file and dotFiles not allow, go next
    if (util.containsDotFile(_index) && self.dotFiles !== 'allow') next();

    // Add index
    _path = path + _index;

    // Stat
    fs.stat(_path, function (err, stat){
      // Debug infomation
      debugResponse('Read: %s %s', _path, err ? err.code : 'OK');

      // Error
      if (err) {
        return next();
      }

      // Is directory
      if (stat.isDirectory()) {
        return next();
      }

      // Emit file event
      listenerCount(self, 'file') > 0 && self.emit('file', _path, stat);

      // Send
      self.send(_path, stat);
    });
  }
};

/**
 * Stream path to the response
 * @param {String} path
 * @api private
 */
SendStream.prototype.stream = function (path){
  var self = this,
    isFinish = false,
    res = self.response,
    ranges = self.ranges,
    transform = new Stream.Transform({ objectMode: false });

  // Implementing _transform
  transform._transform = function (chunk, enc, next){
    // Push data
    this.push(chunk);
    // Continue
    next();
  };

  // Stream error
  function onerror(err){
    // Request already finished
    if (isFinish) return;

    // Destroy stream
    destroy(transform);

    // Found Error
    self.onStatError(err);
  }

  // Contat range
  function concatRange(){
    var range, lenRanges, stream;

    // Request already finished
    if (isFinish) return;

    range = ranges.shift() || {};
    lenRanges = ranges.length;
    stream = fs.createReadStream(path, range);

    // Push boundary
    range.boundary && transform.push(range.boundary);

    // Error handling code-smell
    stream.on('error', function (err){
      // Call onerror
      onerror(err);
      // Destroy stream
      destroy(stream);
    });

    // Stream end
    stream.on('end', function (){
      if (lenRanges > 0) {
        // Recurse ranges
        setImmediate(concatRange);
      } else {
        // Push end boundary
        range.endBoundary && transform.push(range.endBoundary);

        // End transform
        transform.end();
      }

      // Destroy stream
      destroy(stream);
    });

    // Pipe data to transform
    stream.pipe(transform, { end: false });
  }

  // Error handling code-smell
  transform.on('error', onerror);
  // Listen read stream end event
  transform.on('end', function (){
    // Emit end event
    listenerCount(self, 'end') > 0 && self.emit('end');
  });

  // Response finished, done with the fd
  onFinished(res, function (){
    // Is finish
    isFinish = true;
    // Destroy stream
    destroy(transform);
  });

  // Get transform stream
  concatRange();

  // Response
  function next(transform){
    transform.pipe(res);
  }

  // If has stream listener, use user handle
  if (listenerCount(self, 'stream') > 0) {
    self.emit('stream', transform, next);
  } else {
    next(transform);
  }
};

/**
 * Set content-type based on `path` if it hasn't been explicitly set
 * @param {String} path
 * @api private
 */
SendStream.prototype.setContentType = function (path){
  var type, charset,
    res = this.response;

  // Get MIME
  type = mime.lookup(path);
  charset = mime.charsets.lookup(type);

  // Debug infomation
  if (charset) {
    debugResponse('Content-Type %s; charset=%s', type, charset);
  } else {
    debugResponse('Content-Type %s', type);
  }

  // Set Content-Type
  res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
};

/**
 * Set response header fields, most fields may be pre-defined
 * @param {String} path
 * @param {Object} stat
 * @api private
 */
SendStream.prototype.setHeader = function (path, stat){
  var maxAge,
    etagVal,
    lastModified,
    res = this.response;

  // Debug infomation
  debugResponse('Accept-Ranges: bytes');
  // Set Accept-Ranges
  res.setHeader('Accept-Ranges', 'bytes');

  // Set Cache-Control
  maxAge = this.maxAge;

  // Debug infomation
  debugResponse('Cache-Control: public, max-age=%s', maxAge);
  res.setHeader(
    'Cache-Control',
    'public, max-age=' + maxAge
  );

  // Set Last-Modified
  if (this.lastModified) {
    // Get mtime UTC string
    lastModified = stat.mtime.toUTCString();

    // Debug infomation
    debugResponse('Last-Modified: %s', lastModified);
    res.setHeader('Last-Modified', lastModified);
  }

  // Set ETag
  if (this.etag) {
    // Get etag
    etagVal = etag(stat, {
      weak: false // Disable weak etag
    });

    // Debug infomation
    debugResponse('ETag: %s', etagVal);
    res.setHeader('ETag', etagVal);
  }

  // Emit headers event
  listenerCount(this, 'headers') > 0 && this.emit('headers', res, path, stat);
};

// Expose mime
SendStream.mime = mime;

// Expose send
module.exports = SendStream;
