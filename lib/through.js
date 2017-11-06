/**
 * @module through
 * @license MIT
 * @version 2017/10/25
 */

import { typeIs } from './utils';
import { Transform } from 'stream';

/**
 * @class DestroyableTransform
 */
export class DestroyableTransform extends Transform {

  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    super(options);

    this._destroyed = false;
  }

  /**
   * @method destroy
   * @param {any} error
   */
  destroy(error) {
    if (this._destroyed) return;

    this._destroyed = true;

    process.nextTick(() => {
      if (error) this.emit('error', error);

      this.emit('close');
    });
  }
}

/**
 * @function noop
 * @description A noop _transform function
 * @param {any} chunk
 * @param {string} encoding
 * @param {Function} next
 */
function noop(chunk, encoding, next) {
  next(null, chunk);
}

/**
 * @function throuth
 * @description Create a new export function, contains common logic for dealing with arguments
 * @param {Object} [options]
 * @param {Function} transform
 * @param {Function} [flush]
 * @returns {DestroyableTransform}
 */
export function through(options, transform, flush) {
  if (typeIs(options, 'function')) {
    flush = transform;
    transform = options;
    options = {};
  }

  options = options || {};
  options.objectMode = options.objectMode || false;
  options.highWaterMark = options.highWaterMark || 16;

  if (!typeIs(transform, 'function')) transform = noop;
  if (!typeIs(flush, 'function')) flush = null;

  const stream = new DestroyableTransform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;

  return stream;
}
