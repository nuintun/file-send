/*!
 * through
 * Date: 2016/6/21
 * https://github.com/nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/nuintun/file-send/blob/master/LICENSE
 */

'use strict';

var util = require('./util');
var Stream = require('readable-stream');
var Transform = Stream.Transform;

/**
 * DestroyableTransform
 *
 * @param {Object} options
 * @constructor
 */
function DestroyableTransform(options) {
  Transform.call(this, options);

  // Destroyed flag
  this._destroyed = false;
}

// Inherits
DestroyableTransform.prototype = Object.create(Transform.prototype, {
  constructor: { value: DestroyableTransform }
});

/**
 * destroy
 *
 * @param error
 */
DestroyableTransform.prototype.destroy = function(error) {
  if (this._destroyed) return;

  this._destroyed = true;

  var self = this;

  process.nextTick(function() {
    if (error) self.emit('error', error);

    self.emit('close');
  })
};

/**
 * noop
 * @description A noop _transform function
 *
 * @param {any} chunk
 * @param {String} encoding
 * @param {Function} next
 */
function noop(chunk, encoding, next) {
  next(null, chunk);
}

/**
 * throuth
 * @description Create a new export function, used by both the main export and
 *   the .ctor export, contains common logic for dealing with arguments
 *
 * @param {Function} construct
 * @returns {Function}
 */
function through(construct) {
  return function(options, transform, flush) {
    if (util.typeIs(options, 'function')) {
      flush = transform;
      transform = options;
      options = {};
    }

    if (!util.typeIs(transform, 'function')) transform = noop;
    if (!util.typeIs(flush, 'function')) flush = null;

    return construct(options, transform, flush);
  }
}

/**
 * Exports module
 */
module.exports = through(function(options, transform, flush) {
  options = options || {};
  options.objectMode = options.objectMode || false;
  options.highWaterMark = options.highWaterMark || 16;

  var stream = new DestroyableTransform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;

  return stream;
});
