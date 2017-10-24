/*!
 * through
 *
 * Date: 2017/10/24
 *
 * This is licensed under the MIT License (MIT).
 */

'use strict';

const utils = require('./utils');
const Stream = require('readable-stream');
const Transform = Stream.Transform;

/**
 * @class DestroyableTransform
 */
class DestroyableTransform extends Transform {
  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    super(options);

    // Destroyed flag
    this._destroyed = false;
  }

  /**
   * @method destroy
   * @param {any} error
   */
  destroy(error) {
    if (this._destroyed) return;

    this._destroyed = true;

    const self = this;

    process.nextTick(function() {
      if (error) self.emit('error', error);

      self.emit('close');
    });
  }
}

/**
 * @function noop
 * @description A noop _transform function
 * @param {any} chunk
 * @param {String} encoding
 * @param {Function} next
 */
function noop(chunk, encoding, next) {
  next(null, chunk);
}

/**
 * @function throuth
 * @description Create a new export function, used by both the main export and
 *   the .ctor export, contains common logic for dealing with arguments
 * @param {Function} construct
 * @returns {Function}
 */
function through(construct) {
  return function(options, transform, flush) {
    if (utils.typeIs(options, 'function')) {
      flush = transform;
      transform = options;
      options = {};
    }

    if (!utils.typeIs(transform, 'function')) transform = noop;
    if (!utils.typeIs(flush, 'function')) flush = null;

    return construct(options, transform, flush);
  }
}

// Exports
module.exports = through(function(options, transform, flush) {
  options = options || {};
  options.objectMode = options.objectMode || false;
  options.highWaterMark = options.highWaterMark || 16;

  const stream = new DestroyableTransform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;

  return stream;
});
