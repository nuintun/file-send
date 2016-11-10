/*!
 * through
 * Date: 2016/6/21
 * https://github.com/Nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

var util = require('./util');
var Stream = require('readable-stream');
var Transform = Stream.Transform;

/**
 * DestroyableTransform
 * @param options
 * @constructor
 */
function DestroyableTransform(options) {
  Transform.call(this, options);

  // destroyed flag
  this._destroyed = false;
}

// inherits
DestroyableTransform.prototype = Object.create(Transform.prototype, {
  constructor: { value: DestroyableTransform }
});

/**
 * destroy
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
 * a noop _transform function
 * @param chunk
 * @param encoding
 * @param next
 */
function noop(chunk, encoding, next) {
  next(null, chunk);
}

/**
 * create a new export function, used by both the main export and
 * the .ctor export, contains common logic for dealing with arguments
 * @param construct
 * @returns {Function}
 */
function through(construct) {
  return function(options, transform, flush) {
    if (util.isType(options, 'function')) {
      flush = transform;
      transform = options;
      options = {};
    }

    if (!util.isType(transform, 'function')) transform = noop;
    if (!util.isType(flush, 'function')) flush = null;

    return construct(options, transform, flush);
  }
}

/**
 * exports module
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
