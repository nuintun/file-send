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
const url = require('url');
const http = require('http');
const through2 = require('through2');
const FileSend = require('file-send');

http.createServer((request, response) => {
  new FileSend(request, url.parse(request.url).pathname, {
    root: '/',
    etag: true,
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
  .on('end', function(headers) {
    // completed events
  })
  .use(through2()) // Set middleware
  .pipe(response); // Send file to response
});
```

### FileSend(request, path, [options])

  Create a new `FileSend` for the given path and options to initialize.
  The `request` is the Node.js HTTP request and the `path` is a urlencoded path to send (urlencoded, not the actual file-system path).

#### Options

##### *root* - ```String```

  Set server root.

##### *ignore* - ```String|Array```

  Set ignore rules, support glob string.  see: [micromatch](https://github.com/jonschlinkert/micromatch)

##### *glob* - ```Object```

  Set micromatch options.  see: [micromatch](https://github.com/jonschlinkert/micromatch#options)

#### *acceptRanges* - ```Boolean```

  Enable or disable accepting ranged requests, defaults to true. Disabling this will not send Accept-Ranges and ignore the contents of the Range request header.

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

##### *lastModified* - ```Boolean```

  Enable or disable `Last-Modified` header, defaults to true. Uses the file system's last modified value.

##### *maxAge* - ```String|Number```

  Provide a max-age in milliseconds for http caching, defaults to 0.
  This can also be a string accepted by the [ms](https://www.npmjs.org/package/ms#readme) module.

##### *immutable* - ```Boolean```

Enable or diable the immutable directive in the Cache-Control response header, defaults to false. If set to true, the maxAge option should also be specified to enable caching. The immutable directive will prevent supported clients from making conditional requests during the life of the maxAge option to check if the file has changed.

### FileSend(request, path, [options]).pipe(response)

  The `pipe` method is used to pipe the response into the Node.js HTTP response object, typically `FileSend(request, path, [options]).pipe(response)`.

### FileSend.mime

  The mime export is the global instance of of the mime npm module.

  This is used to configure the MIME types that are associated with file extensions as well as other options for how to resolve the MIME type of a file (like the default type to use for an unknown file extension).

### Events
  The `FileSend` is an event emitter and will emit the following events:

  - `headers` the headers are about to be set on a file `(headers)`
  - `dir` a directory was requested`(realpath, next)`
  - `error` an error occurred `(error, next)`
  - `end` streaming has completed

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

const url = require('url');
const http = require('http');
const chalk = require('chalk');
const cluster = require('cluster');
const FileSend = require('file-send');
const NUMCPUS = require('os').cpus().length;

// create server
function createServer(root, port) {
  http.createServer(function(request, response) {
    const send = new FileSend(request, url.parse(request.url).pathname, {
      root: root || process.cwd(),
      maxAge: '3day',
      ignore: ['/**/.*?(/*.*|/)'],
      index: ['index.html']
    });

    send.on('headers', function(headers) {
      const message = 'URL      : ' + chalk.green.bold(request.url)
        + '\r\nPATH     : ' + chalk.yellow.bold(send.path)
        + '\r\nROOT     : ' + chalk.magenta.bold(send.root)
        + '\r\nREALPATH : ' + chalk.magenta.bold(send.realpath)
        + '\r\nSTATUS   : ' + chalk.cyan.bold(send.statusCode)
        + '\r\nHEADERS  : ' + chalk.cyan.bold(JSON.stringify(headers, null, 2))
        + '\r\n-----------------------------------------------------------------------------------------';

      process.send(message);
    });

    send.pipe(response);
  }).listen(port || 8080);
}

if (cluster.isMaster) {
  // fork workers
  for (let i = 0; i < NUMCPUS; i++) {
    const worker = cluster.fork();
    
    // worker is listening
    if (i === NUMCPUS - 1) {
      worker.on('listening', (address) => {
        console.log(
          chalk.green.bold('Server run at:'),
          chalk.cyan.bold((address.address || '127.0.0.1') + ':' + address.port),
          '\r\n-----------------------------------------------------------------------------------------'
        );      
      });
    }

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

[travis-image]: https://img.shields.io/travis/nuintun/file-send/master.svg?style=flat-square&label=linux
[travis-url]: https://travis-ci.org/nuintun/file-send
[appveyor-image]: https://img.shields.io/appveyor/ci/nuintun/file-send/master.svg?style=flat-square&label=windows
[appveyor-url]: https://ci.appveyor.com/project/nuintun/file-send
[coveralls-image]: https://img.shields.io/coveralls/nuintun/file-send/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/nuintun/file-send?branch=master
[node-image]: https://img.shields.io/node/v/file-send.svg?style=flat-square
[david-image]: https://img.shields.io/david/nuintun/file-send.svg?style=flat-square
[david-url]: https://david-dm.org/nuintun/file-send
[npm-image]: https://img.shields.io/npm/v/file-send.svg?style=flat-square
[npm-url]: https://www.npmjs.org/package/file-send
[download-image]: https://img.shields.io/npm/dm/file-send.svg?style=flat-square
