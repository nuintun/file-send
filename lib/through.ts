/// <reference path="../typings/readable-stream.d.ts" />

/**
 * @module through
 * @license MIT
 * @version 2017/10/25
 */

import { typeIs } from './utils';
import { Transform, TransformOptions } from 'readable-stream';

export type NextFunction = (error: any, chunk?: any) => void;
export type TransformFunction = (chunk: any, encoding: string, next: NextFunction) => void;
export type FlushFunction = () => void;

/**
 * @class DestroyableTransform
 */
export class DestroyableTransform extends Transform {
  private _destroyed: boolean = false;

  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options: TransformOptions) {
    super(options);
  }

  /**
   * @method destroy
   * @param {any} error
   */
  destroy(error: any): void {
    if (this._destroyed) return;

    this._destroyed = true;

    const self: DestroyableTransform = this;

    process.nextTick(function (): void {
      if (error) self.emit('error', error);

      self.emit('close');
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
function noop(chunk: any, _encoding: string, next: NextFunction): void {
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
export default function through(options: TransformOptions, transform?: TransformFunction, flush?: FlushFunction): DestroyableTransform {
  if (typeIs(options, 'function')) {
    flush = <FlushFunction>transform;
    transform = <TransformFunction>options;
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
