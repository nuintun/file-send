/**
 * file-send
 * https://nuintun.github.io/file-send
 *
 * Licensed under the MIT license
 * https://github.com/Nuintun/file-send/blob/master/LICENSE
 */

'use strict';

// External lib
var ms = require('ms');
var nopt = require('nopt');
var colors = require('colors/safe');
var util = require('./util');

// Variable declaration
var FORMATRE = /%s/g;
var slice = Array.prototype.slice;
var verbose = nopt({ verbose: Boolean }, { v: '--verbose' }, process.argv, 2).verbose;

/**
 * Format string
 * @returns {string}
 */
function format(){
  var i = 0;
  var str = arguments[0] || '';
  var args = slice.call(arguments, 1);

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
      colors.blue.bold('[DEBUG] ')
      + colors.cyan.bold(namespace + ' - ')
      + format.apply(this, arguments)
      + colors.cyan.bold(' +' + ms(timestamp.diff))
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
  util.readonlyProperty(timestamp, 'reset', function (){
    if (debug.verbose) {
      var curr = +new Date(); // Set `diff` timestamp

      timestamp.diff = curr - (timestamp.prev || curr);
      timestamp.prev = curr;
    }
  });

  return timestamp;
};

// Exports
module.exports = debug;