/**
 * @module through
 * @license MIT
 * @author nuintun
 */

import { typeOf } from './utils';
import { Transform } from 'stream';

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
 * @function through
 * @param {Object} options
 * @param {Function} transform
 * @param {Function} flush
 * @returns {Transform}
 */
export default function through(options, transform, flush, destroy) {
  if (typeOf(options, 'function')) {
    flush = transform;
    transform = options;
    options = {};
  } else if (!typeOf(transform, 'function')) {
    transform = noop;
  }

  if (!typeOf(flush, 'function')) flush = null;

  if (!typeOf(destroy, 'function')) destroy = null;

  options = options || {};

  if (typeOf(options.objectModem, 'undefined')) {
    options.objectMode = true;
  }

  if (typeOf(options.highWaterMark, 'undefined')) {
    options.highWaterMark = 16;
  }

  const stream = new Transform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;
  if (destroy) stream._destroy = destroy;

  return stream;
}
