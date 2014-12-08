/**
 * nengine
 * https://nuintun.github.io/nengine
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/nengine/blob/master/LICENSE
 */

'use strict';

var ms = require('ms'),  // External libs
  nopt = require('nopt'),
  verbose = nopt(
    { verbose: Boolean },
    { v: '--verbose' },
    process.argv, 2
  ).verbose,
  FORMATRE = /%s/g,
  slice = Array.prototype.slice;

// Colors
require('colors');

/**
 * Format string
 * @returns {string}
 */
function format(){
  var i = 0,
    str = arguments[0] || '',
    args = slice.call(arguments, 1);

  // Reset lastIndex
  FORMATRE.lastIndex = 0;

  // Replace string
  return str.replace(FORMATRE, function (){
    return args[i++] + '';
  });
}

/**
 * Debug
 * @param namespace
 * @param timestamp
 * @returns {fn}
 */
function debug(namespace, timestamp){
  // Timestamp
  timestamp = timestamp || debug.timestamp();

  fn.timestamp = timestamp;

  /**
   * Debug fn
   */
  function fn(){
    // Reset timestamp
    fn.timestamp.reset();

    // Console
    debug.verbose && console.log(
      '[DEBUG] '.blue.bold
      + (namespace + ' - ').cyan.bold
      + format.apply(this, arguments)
      + (' +' + ms(timestamp.diff)).cyan.bold
    );
  }

  return fn;
}

// Verbose
debug.verbose = verbose || false;

/**
 * Timestamp
 * @returns {{}}
 */
debug.timestamp = function (){
  var timestamp = {};

  // Reset timestamp method
  Object.defineProperty(timestamp, 'reset', {
    __proto__: null,
    writable: false,
    enumerable: false,
    configurable: false,
    value: function (){
      if (debug.verbose) {
        var curr = +new Date(); // Set `diff` timestamp

        timestamp.diff = curr - (timestamp.prev || curr);
        timestamp.prev = curr;
      }
    }
  });

  return timestamp;
};

// Exports
module.exports = debug;