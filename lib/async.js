/*!
 * async
 *
 * Date: 2017/10/24
 *
 * This is licensed under the MIT License (MIT).
 */

'use strict';

/**
 * @class Iterator
 */
class Iterator {
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
 * series
 *
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
function series(array, iterator, done, context) {
  // Create a new iterator
  const it = new Iterator(array);

  // Bind context
  if (arguments.length >= 4) {
    iterator = iterator.bind(context);
    done = done.bind(context);
  }

  /**
   * walk
   *
   * @param it
   */
  function walk(it) {
    const item = it.next();

    if (item.done) {
      done();
    } else {
      iterator(item.value, function() {
        walk(it);
      });
    }
  }

  // Run walk
  walk(it);
}

// Exports
module.exports = {
  Iterator,
  series
};
