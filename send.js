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
  // Format options
  options = options || {};

  // Set options property
  Object.defineProperty(this, 'options', {
    __proto__: null,
    writable: false,
    enumerable: false,
    configurable: false,
    value: {
      // Root
      set root(root){
        root = util.isType(root, 'string')
          ? path.resolve(root)
          : cwd;

        this._root = util.httpPath(root + path.sep);
      },
      get root(){
        return this._root;
      },
      // Index
      set index(index){
        // Default document
        this._index = index === false
          ? []
          : index === undefined || index === true
          ? ['index.htm', 'index.html']
          : util.normalizeList(index);
      },
      get index(){
        return this._index;
      },
      // Extensions
      set extensions(extensions){
        this._extensions = !extensions
          ? []
          : util.normalizeList(extensions);
      },
      get extensions(){
        return this._extensions;
      },
      // Etag
      set etag(etag){
        this._etag = etag !== undefined
          ? Boolean(etag)
          : true;
      },
      get etag(){
        return this._etag;
      },
      // LastModified
      set lastModified(lastModified){
        this._lastModified = lastModified !== undefined
          ? Boolean(lastModified)
          : true;
      },
      get lastModified(){
        return this._lastModified;
      },
      // MaxAge
      set maxAge(maxAge){
        // Max age
        maxAge = util.isType(maxAge, 'string')
          ? (ms(maxAge) || 0) / 1000
          : Number(maxAge);

        maxAge = maxAge >= 0
          ? Math.min(maxAge, MAXMAXAGE)
          : 0;

        this._maxAge = Math.floor(maxAge);
      },
      get maxAge(){
        return this._maxAge;
      },
      // DotFiles
      set dotFiles(dotFiles){
        // Dot files access, The value can be "allow", "deny", or "ignore"
        this._dotFiles = util.isType(dotFiles, 'string')
          ? dotFiles.toLowerCase()
          : 'ignore';
      },
      get dotFiles(){
        return this._dotFiles;
      }
    }
  });

  // Root
  this.options.root = root;

  // ETag
  this.options.etag = options.etag;

  // DotFiles
  this.options.dotFiles = options.dotFiles;

  // Extensions
  this.options.extensions = options.extensions;

  // Default document
  this.options.index = options.index;

  // Last modified
  this.options.lastModified = options.lastModified;

  // Max age
  this.options.maxAge = options.maxAge;

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
  // If options have the property, set it
  if (this.options[key]) {
    this.options[key] = value;
  }

  // Return instance
  return this;
};

// Expose mime
Send.mime = SendStream.mime;

// Expose send
module.exports = Send;
