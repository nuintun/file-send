# file-send

>A http/https file send
>
>[![NPM Version][npm-image]][npm-url]
>[![Download Status][download-image]][npm-url]
>[![Linux Status][travis-image]][travis-url]
>[![Windows Status][appveyor-image]][appveyor-url]
>[![Test Coverage][coveralls-image]][coveralls-url]
>![Node Version][node-image]
>[![Dependencies][david-image]][david-url]

## Installation

```bash
$ npm install file-send
```

## API

```js
var http = require('http');
var FileSend = require('file-send');
var through2 = require('through2');

http.createServer(function(request, response) {
  FileSend(request, {
    root: '/',
    etag: false,
    maxAge: '30d'
  }) // Create a new file send stream
  .on('headers', function(headers) {
    // headers events
  })
  .on('dir', function(realpath, stats, next) {
    // dir events
  })
  .on('error', function(error, next) {
    // error events
  })
  .on('finish', function(headers) {
    // finish events
  })
  .pipe(through2()) // Send file to custom stream
  .pipe(response); // Send file to response
});
```

### FileSend(request, [options])

  Create a new `FileSend` for the given options to initialize.

#### Options

##### *root* - ```String```

  Set server root.

##### *ignore* - ```String|Array```

  Set ignore rules, support glob string.  see: [micromatch](https://github.com/jonschlinkert/micromatch)

##### *glob* - ```Object```

  Set micromatch options.  see: [micromatch](https://github.com/jonschlinkert/micromatch#options)

##### *ignoreAccess* - ```String```

  Set how "ignore" are treated when encountered.

  The default value is `'deny'`.

  - `'deny'` Send a 403 for any request for ignore matched.
  - `'ignore'` Pretend like the ignore matched does not exist and 404.

##### *charset* - ```String```

  Set Content-Type charset.

##### *parseQueryString* - ```String```

  Set url.parse options. see node url module.

##### *slashesDenoteHost* - ```String```

  Set url.parse options. see node url module.

##### *etag* - ```Boolean```

  Enable or disable etag generation, defaults to true.

##### *index* - ```String|Array|Boolean```

  By default send supports "index.html" files, to disable this set `false` or to supply a new index pass a string or an array in preferred order.

##### *lastModified*

  Enable or disable `Last-Modified` header, defaults to true. Uses the file system's last modified value.

##### *maxAge*

  Provide a max-age in milliseconds for http caching, defaults to 0.
  This can also be a string accepted by the [ms](https://www.npmjs.org/package/ms#readme) module.

### FileSend(request, [options]).pipe(response)

 The `pipe` method is like stream.pipe, but only hava one param.

### Events
  The `FileSend` is an event emitter and will emit the following events:

  - `headers` the headers are about to be set on a file `(headers)`
  - `dir` a directory was requested`(realpath, stats, next)`
  - `error` an error occurred `(error, next)`
  - `finish` streaming has completed

## Error-handling

  By default when no `error` listeners are present an automatic response will be made, otherwise you have full control over the response, aka you may show a 5xx page etc.

## Caching

  It does _not_ perform internal caching, you should use a reverse proxy cache such as Varnish for this, or those fancy things called CDNs. If your application is small enough that it would benefit from single-node memory caching, it's small enough that it does not need caching at all ;).

## Running tests

```
$ npm install
$ npm test
```

## Examples

```js
'use strict';

var http = require('http');
var FileSend = require('../index');
var colors = require('colors/safe');
var cluster = require('cluster');
var NUMCPUS = require('os').cpus().length;

// create server
function createServer(root, port) {
  http.createServer(function(request, response) {
    var send = new FileSend(request, {
      root: root || '../',
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['index.html']
    });

    send.pipe(response).on('headers', function(headers) {
      var message = 'URL      : ' + colors.green.bold(send.url) +
        '\r\nPATH     : ' + colors.yellow.bold(send.path) +
        '\r\nROOT     : ' + colors.magenta.bold(send.root) +
        '\r\nREALPATH : ' + colors.magenta.bold(send.realpath) +
        '\r\nSTATUS   : ' + colors.cyan.bold(send.statusCode) +
        '\r\nHEADERS  : ' + colors.cyan.bold(JSON.stringify(headers, null, 2)) +
        '\r\n-----------------------------------------------------------------------------------------';

      process.send(message);
    });
  }).listen(port || 8080, '127.0.0.1');
}

if (cluster.isMaster) {
  // fork workers
  for (var i = 0; i < NUMCPUS; i++) {
    var worker = cluster.fork().on('listening', (function(i) {
      return function(address) {
        // worker is listening
        if (i === NUMCPUS - 1) {
          console.log(
            colors.green.bold('Server run at:'),
            colors.cyan.bold(address.address + ':' + address.port),
            '\r\n-----------------------------------------------------------------------------------------'
          );
        }
      };
    }(i)));

    worker.on('message', function(message) {
      console.log(message);
    });
  }
} else {
  // workers can share any tcp connection
  // in this case it is an http server
  createServer();
}
```

## License

[MIT](LICENSE)

[travis-image]: https://img.shields.io/travis/nuintun/file-send.svg?style=flat-square&label=linux
[travis-url]: https://travis-ci.org/nuintun/file-send
[appveyor-image]: https://img.shields.io/appveyor/ci/nuintun/file-send.svg?style=flat-square&label=windows
[appveyor-url]: https://ci.appveyor.com/project/nuintun/file-send
[coveralls-image]: https://img.shields.io/coveralls/nuintun/file-send/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/nuintun/file-send?branch=master
[node-image]: https://img.shields.io/node/v/file-send.svg?style=flat-square
[david-image]: https://img.shields.io/david/nuintun/file-send.svg?style=flat-square
[david-url]: https://david-dm.org/nuintun/file-send
[npm-image]: https://img.shields.io/npm/v/file-send.svg?style=flat-square
[npm-url]: https://www.npmjs.org/package/file-send
[download-image]: https://img.shields.io/npm/dm/file-send.svg?style=flat-square
