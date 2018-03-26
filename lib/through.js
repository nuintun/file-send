/**
 * @module through
 * @license MIT
 * @version 2017/10/25
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

const undef = void 0;
// Is destroyable Transform
const destroyable = Transform.prototype.destroy;
const DestroyableTransform = destroyable
  ? Transform
  : class extends Transform {
      /**
       * @constructor
       * @param {Object} options
       */
      constructor(options) {
        super(options);

        this._destroyed = false;
      }

      /**
       * @private
       * @method _destroy
       * @param {any} error
       * @param {Function} callback
       */
      _destroy(error, callback) {
        if (this._destroyed) return;

        this._destroyed = true;

        process.nextTick(() => {
          if (error) {
            if (callback) {
              callback();
            } else {
              this.emit('error', error);
            }
          }

          this.emit('close');
        });
      }

      /**
       * @function destroy
       * @param {any} error
       * @param {Function} callback
       */
      destroy(error, callback) {
        this._destroy(error, callback);
      }
    };

/**
 * @function through
 * @param {Object} options
 * @param {Function} transform
 * @param {Function} flush
 * @returns {Transform}
 */
export function through(options, transform, flush, destroy) {
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

  if (options.objectMode === undef) {
    options.objectMode = true;
  }

  if (options.highWaterMark === undef) {
    options.highWaterMark = 16;
  }

  const stream = new DestroyableTransform(options);

  stream._transform = transform;

  if (flush) stream._flush = flush;
  if (destroy) stream._destroy = destroy;

  return stream;
}
