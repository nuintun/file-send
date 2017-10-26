/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */

import * as ms from 'ms';
import * as fs from 'fs';
import * as url from 'url';
import * as path from 'path';
import * as http from 'http';
import * as etag from 'etag';
import * as fresh from 'fresh';
import * as Stream from 'stream';
import * as destroy from 'destroy';
import * as mime from 'mime-types';
import * as utils from './lib/utils';
import * as async from './lib/async';
import * as encodeUrl from 'encodeurl';
import { through } from './lib/through';
import * as micromatch from 'micromatch';
import * as onFinished from 'on-finished';
import * as escapeHtml from 'escape-html';
import * as parseRange from 'range-parser';

// Current working directory
const CWD = process.cwd();
// The max max-age set
const MAXMAXAGE = 60 * 60 * 24 * 365;
// File not found status
const NOTFOUND = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

// Common method
const originWriteHead = http.ServerResponse.prototype.writeHead;

// Add http response write headers events
http.ServerResponse.prototype.writeHead = function() {
  // Emit headers event
  if (this.listenerCount('headers') > 0) {
    this.emit('headers');
  }

  // Call origin method
  util.apply(originWriteHead, this, arguments);
};

/**
 * @class FileSend
 */

export default class FileSend extends Stream {
  /**
   * @constructor
   * @param {Request} request
   * @param {Object} options
   */
  constructor(request, path, options) {
    super();
  }
}
