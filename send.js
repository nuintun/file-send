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
  // Max age
  var maxAge;

  // Format options
  options = util.mix({}, options);

  // Root
  root = util.isType(root, 'string')
    ? path.resolve(root)
    : cwd;

  root = util.httpPath(root + path.sep);

  // Set root options
  options.root = root;

  // Etag
  options.etag = options.etag !== undefined
    ? Boolean(options.etag)
    : true;

  // Dot files access, The value can be "allow", "deny", or "ignore"
  options.dotFiles = util.isType(options.dotFiles, 'string')
    ? options.dotFiles.toLowerCase()
    : 'ignore';

  // Extensions
  options.extensions = !options.extensions
    ? []
    : util.normalizeList(options.extensions);

  // Default document
  options.index = options.index === false
    ? []
    : options.index === undefined || options.index === true
    ? ['index.htm', 'index.html']
    : util.normalizeList(options.index);

  // Last modified
  options.lastModified = options.lastModified !== undefined
    ? Boolean(options.lastModified)
    : true;

  // Max age
  maxAge = options.maxAge;

  maxAge = util.isType(maxAge, 'string')
    ? (ms(maxAge) || 0) / 1000
    : Number(maxAge);

  options.maxAge = maxAge >= 0
    ? Math.min(maxAge, MAXMAXAGE)
    : 0;

  options.maxAge = Math.floor(options.maxAge);

  // Set other property
  this.options = options;

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

Send.prototype.set = function (key, value){

};

// Expose mime
Send.mime = SendStream.mime;

// Expose send
module.exports = Send;
