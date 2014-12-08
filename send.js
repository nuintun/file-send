/**
 * nengine
 * https://nuintun.github.io/nengine
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/nengine/blob/master/LICENSE
 */

'use strict';

var ms = require('ms'), // Parse time string
  cwd = process.cwd(), // Current working directory of the process
  path = require('path'), // Path
  util = require('./lib/util'), // Util
  MAXMAXAGE = 60 * 60 * 24 * 365, // The max maxAge set
  SendStream = require('./lib/send-stream');

/**
 * Send
 * @param {String} root
 * @param {Object} options
 * @return {Send}
 * @api public
 */
function Send(root, options){
  // Set other property
  this.options = {};

  // Format options
  options = options || {};

  // Root
  this._set_root(root);

  // ETag
  this._set_etag(options.etag);

  // dotFiles
  this._set_dotFiles(options.dotFiles);

  // Extensions
  this._set_extensions(options.extensions);

  // Default document
  this._set_index(options.index);

  // Last modified
  this._set_lastModified(options.lastModified);

  // Max age
  this._set_maxAge(options.maxAge);

  // Return instance
  return this;
}

/**
 * Create send stream
 * @param {Object} requset
 * @param {Object} response
 * @returns {SendStream}
 * @api public
 */
Send.prototype.use = function (requset, response){
  return new SendStream(requset, response, this.options);
};

/**
 * Set options
 * @param key
 * @param value
 * @returns {Send}
 */
Send.prototype.set = function (key, value){
  // Get method name
  key = '_set_' + key;

  // If method found, run it
  this[key] && this[key](value);

  // Return instance
  return this;
};

/**
 * Set root
 * @private
 */
Send.prototype._set_root = function (root){
  // Root
  root = util.isType(root, 'string')
    ? path.resolve(root)
    : cwd;

  root = util.httpPath(root + path.sep);

  // Set root options
  this.options.root = root;
};

/**
 * Set Etag
 * @private
 */
Send.prototype._set_etag = function (etag){
  // Etag
  etag = etag !== undefined
    ? Boolean(etag)
    : true;

  // Set etag options
  this.options.etag = etag;
};

/**
 * Set dotFiles
 * @private
 */
Send.prototype._set_dotFiles = function (dotFiles){
  // Dot files access, The value can be "allow", "deny", or "ignore"
  dotFiles = util.isType(dotFiles, 'string')
    ? dotFiles.toLowerCase()
    : 'ignore';

  // Set dotFiles options
  this.options.dotFiles = dotFiles;
};

/**
 * Set extensions
 * @private
 */
Send.prototype._set_extensions = function (extensions){
  // Extensions
  extensions = !extensions
    ? []
    : util.normalizeList(extensions);

  // Set extensions options
  this.options.extensions = extensions;
};

/**
 * Set index
 * @private
 */
Send.prototype._set_index = function (index){
  // Default document
  index = index === false
    ? []
    : index === undefined || index === true
    ? ['index.htm', 'index.html']
    : util.normalizeList(index);

  // Set index options
  this.options.index = index;
};
/**
 * Set lastModified
 * @private
 */
Send.prototype._set_lastModified = function (lastModified){
  // Last modified
  lastModified = lastModified !== undefined
    ? Boolean(lastModified)
    : true;

  // Set lastModified options
  this.options.lastModified = lastModified;
};

/**
 * Set maxAge
 * @private
 */
Send.prototype._set_maxAge = function (maxAge){
  // Max age
  maxAge = util.isType(maxAge, 'string')
    ? (ms(maxAge) || 0) / 1000
    : Number(maxAge);

  maxAge = maxAge >= 0
    ? Math.min(maxAge, MAXMAXAGE)
    : 0;

  maxAge = Math.floor(maxAge);

  // Set maxAge options
  this.options.maxAge = maxAge;
};

// Expose mime
Send.mime = SendStream.mime;

// Expose send
module.exports = Send;
