/*!
 * async
 * Date: 2016/6/21
 * https://github.com/nuintun/file-send
 *
 * This is licensed under the MIT License (MIT).
 * For details, see: https://github.com/nuintun/file-send/blob/master/LICENSE
 */

'use strict';

/**
 * Iterator
 *
 * @param {Array} array
 * @constructor
 */
function Iterator(array) {
  this.index = 0;
  this.array = Array.isArray(array) ? array : [];
}

/**
 * next
 *
 * @description Create the next item.
 * @returns {{done: boolean, value: undefined}}
 */
Iterator.prototype.next = function() {
  var done = this.index >= this.array.length;
  var value = !done ? this.array[this.index++] : undefined;

  return {
    done: done,
    value: value
  };
};

/**
 * Exports module
 */
module.exports = {
  Iterator: Iterator,
  series: function(array, iterator, done, context) {
    // Create a new iterator
    var it = new Iterator(array);

    // Bind context
    if (arguments.length >= 4) {
      iterator = iterator.bind(context);
      done = done.bind(context);
    }

    /**
     * Walk
     *
     * @param it
     */
    function walk(it) {
      var item = it.next();

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
};
