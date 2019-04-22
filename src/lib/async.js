/**
 * @module async
 * @license MIT
 * @author nuintun
 */

/**
 * @class Iterator
 */
export class Iterator {
  /**
   * @constructor
   * @param {Array} array
   */
  constructor(array) {
    this.index = 0;
    this.array = Array.isArray(array) ? array : [];
  }

  /**
   * @method next
   * @description Create the next item.
   * @returns {{done: boolean, value: undefined}}
   */
  next() {
    const done = this.index >= this.array.length;
    const value = !done ? this.array[this.index++] : undefined;

    return {
      done: done,
      value: value
    };
  }
}

/**
 * @function series
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
export function series(array, iterator, done) {
  // Create a new iterator
  const it = new Iterator(array);

  /**
   * @function walk
   * @param it
   */
  function walk(it) {
    const item = it.next();

    if (item.done) {
      done();
    } else {
      iterator(item.value, () => walk(it), it.index);
    }
  }

  // Run walk
  walk(it);
}
