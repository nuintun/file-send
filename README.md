# file-send

> A http/https file send
>
> [![NPM Version][npm-image]][npm-url]
> [![Download Status][download-image]][npm-url]
> [![Linux Status][circleci-image]][circleci-url]
> [![Windows Status][appveyor-image]][appveyor-url]
> [![Test Coverage][codecov-image]][codecov-url]
> ![Node Version][node-image]
> [![Dependencies][david-image]][david-url]

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
  })
    .on('dir', function(realpath, next) {
      // dir events
      next('dir');
    })
    .on('error', function(error, next) {
      // error events
      next('error');
    })
    .use(through2()) // Set middleware
    .pipe(response); // Send file to response
});
```

### FileSend(request, path, [options])

Create a new `FileSend` for the given path and options to initialize.
The `request` is the Node.js HTTP request and the `path` is a urlencoded path to send (urlencoded, not the actual file-system path).

#### Options

##### _root_ - `String`

Set server root.

##### _ignore_ - `String|Array`

Set ignore rules, support glob string. see: [micromatch](https://github.com/jonschlinkert/micromatch)

##### _ignoreAccess_ - `String`

Set how "ignore" are treated when encountered.

The default value is `'deny'`.

- `'deny'` Send a 403 for any request for ignore matched.
- `'ignore'` Pretend like the ignore matched does not exist and 404.

##### _glob_ - `Object`

Set micromatch options. see: [micromatch](https://github.com/jonschlinkert/micromatch#options)

#### _acceptRanges_ - `Boolean`

Enable or disable accepting ranged requests, defaults to true. Disabling this will not send Accept-Ranges and ignore the contents of the Range request header.

##### _charset_ - `String`

Set Content-Type charset.

##### _cacheControl_ - `Boolean`

Enable or disable setting `Cache-Control` response header, defaults to true. Disabling this will ignore the `immutable` and `maxAge` options.

##### _etag_ - `Boolean`

Enable or disable etag generation, defaults to true.

##### _index_ - `String|Array|Boolean`

By default send supports "index.html" files, to disable this set `false` or to supply a new index pass a string or an array in preferred order.

##### _lastModified_ - `Boolean`

Enable or disable `Last-Modified` header, defaults to true. Uses the file system's last modified value.

##### _maxAge_ - `String|Number`

Provide a max-age in milliseconds for http caching, defaults to 0.
This can also be a string accepted by the [ms](https://www.npmjs.org/package/ms#readme) module.

##### _immutable_ - `Boolean`

Enable or diable the immutable directive in the Cache-Control response header, defaults to false. If set to true, the maxAge option should also be specified to enable caching. The immutable directive will prevent supported clients from making conditional requests during the life of the maxAge option to check if the file has changed.

### FileSend(request, path, [options]).pipe(response)

The `pipe` method is used to pipe the response into the Node.js HTTP response object, typically `FileSend(request, path, [options]).pipe(response)`.

### FileSend.mime

The mime export is the global instance of of the `mime-types` npm module.

### Events

The `FileSend` is an event emitter and will emit the following events:

- `dir` a directory was requested`(realpath, next)`
- `file` a file was requested `(realpath, stats)`
- `error` an error occurred `(error, next)`

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
  http
    .createServer(function(request, response) {
      const send = new FileSend(request, url.parse(request.url).pathname, {
        root: root || process.cwd(),
        maxAge: '3day',
        index: ['index.html'],
        ignore: ['/**/.*?(/*.*|/)']
      });

      send.pipe(response);
    })
    .listen(port || 8080);
}

if (cluster.isMaster) {
  // fork workers
  for (let i = 0; i < NUMCPUS; i++) {
    const worker = cluster.fork();

    // worker is listening
    if (i === NUMCPUS - 1) {
      worker.on('listening', address => {
        console.log(
          chalk.green.bold('Server run at:'),
          chalk.cyan.bold((address.address || '127.0.0.1') + ':' + address.port),
          '\r\n-----------------------------------------------------------------------------------------'
        );
      });
    }
  }
} else {
  // workers can share any tcp connection
  // in this case it is an http server
  createServer();
}
```

## License

[MIT](LICENSE)

[circleci-image]: https://img.shields.io/circleci/project/github/nuintun/file-send.svg?style=flat-square&label=linux
[circleci-url]: https://circleci.com/gh/nuintun/file-send
[appveyor-image]: https://img.shields.io/appveyor/ci/nuintun/file-send/master.svg?style=flat-square&label=windows
[appveyor-url]: https://ci.appveyor.com/project/nuintun/file-send
[codecov-image]: https://img.shields.io/codecov/c/github/nuintun/file-send.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/nuintun/file-send
[node-image]: https://img.shields.io/node/v/file-send.svg?style=flat-square
[david-image]: https://img.shields.io/david/nuintun/file-send.svg?style=flat-square
[david-url]: https://david-dm.org/nuintun/file-send
[npm-image]: https://img.shields.io/npm/v/file-send.svg?style=flat-square
[npm-url]: https://www.npmjs.org/package/file-send
[download-image]: https://img.shields.io/npm/dm/file-send.svg?style=flat-square
