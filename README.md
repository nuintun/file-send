file-send
=========

>A http file send

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
var http = require('http'),
  FileSend = require('file-send'),
  Send = FileSend('/', {
    etag: false,
    maxAge: '30d'
  });

http.createServer(function (request, response){
  Send.use(request) // Create a new send stream
    .pipe(response); // Send stream to client
});
```

### FileSend(root, [options])

  Create a new `Send` for the given `root` path and options to initialize.

#### Options

##### *dotFiles*

  Set how "dotFiles" are treated when encountered. A dotFile is a file or directory that begins with a dot ("."). Note this check is done on the path itself without checking if the path actually exists on the disk. If `root` is specified, only the dotfiles above the root are checked (i.e. the root itself can be within a dotfile).

  The default value is `'ignore'`.

  - `'allow'` No special treatment for dotfiles.
  - `'deny'` Send a 403 for any request for a dotfile.
  - `'ignore'` Pretend like the dotfile does not exist and 404.

##### *etag*

  Enable or disable etag generation, defaults to true.

##### *extensions*

  If a given file doesn't exist, try appending one of the given extensions, in the given order. By default, this is disabled (set to `false`). An example value that will serve extension-less HTML files: `['html', 'htm']`.
  This is skipped if the requested file already has an extension.

##### *index*

  By default send supports "index.html" files, to disable this set `false` or to supply a new index pass a string or an array in preferred order.

##### *lastModified*

  Enable or disable `Last-Modified` header, defaults to true. Uses the file system's last modified value.

##### *maxAge*

  Provide a max-age in milliseconds for http caching, defaults to 0.
  This can also be a string accepted by the [ms](https://www.npmjs.org/package/ms#readme) module.

### Send.use(request)

```js
var stream = Send.use(request); // The Send.use return a new send stream
```

  Create a new `SendStream` for the given `request` and `response`.

### Events
  The `SendStream` is an event emitter and will emit the following events:

  - `error` an error occurred `(err)`
  - `directory` a directory was requested
  - `file` a file was requested `(path, stat)`
  - `headers` the headers are about to be set on a file `(response, path, stat)`
  - `stream` file streaming has started `(stream, next(stream))`
  - `end` streaming has completed

### stream.pipe(response)

  The `pipe` method is used to pipe the response into the Node.js HTTP response object, typically `Send.use(req).pipe(res)`.

## Error-handling

  By default when no `error` listeners are present an automatic response will be made, otherwise you have full control over the response, aka you may show a 5xx page etc.

## Caching

  It does _not_ perform internal caching, you should use a reverse proxy cache such as Varnish for this, or those fancy things called CDNs. If your application is small enough that it would benefit from single-node memory caching, it's small enough that it does not need caching at all ;).

## Debugging

  To enable `debug()` instrumentation:

```
$ node app -v
```
or:
```
$ node app -verbose
```

## Running tests

```
$ npm install
$ npm test
```

## Examples

  Serving from a root directory with custom error-handling:

```js
var http = require('http'),
  FileSend = require('file-send'),
  Send = FileSend('/www/example.com/public'); // Set root

// Your custom error-handling logic:
function error(err) {
  var res = this.response;
  res.statusCode = err.status || 500;
  res.end(err.message);
}

// Your custom headers
function headers(res, path, stat) {
  // serve all files for download
  res.setHeader('Content-Disposition', 'attachment');
}

// Your custom directory handling logic:
function directory(path, stat) {
  // TODO You can do something here
  // Like displays the current directory file list
  this.response.end('This is a directory !');
}

var app = http.createServer(function(request, response){
  // Transfer arbitrary files from within /www/example.com/public/*
  Send.use(request)
    .on('error', error)
    .on('directory', directory)
    .on('headers', headers)
    .pipe(response);
}).listen(3000);
```

## License

[MIT](LICENSE)

[travis-image]: http://img.shields.io/travis/nuintun/file-send.svg?style=flat-square&label=linux
[travis-url]: https://travis-ci.org/nuintun/file-send
[appveyor-image]: https://img.shields.io/appveyor/ci/nuintun/file-send.svg?style=flat-square&label=windows
[appveyor-url]: https://ci.appveyor.com/project/nuintun/file-send
[coveralls-image]: http://img.shields.io/coveralls/nuintun/file-send/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/nuintun/file-send?branch=master
[node-image]: http://img.shields.io/node/v/file-send.svg?style=flat-square
[david-image]: http://img.shields.io/david/nuintun/file-send.svg?style=flat-square
[david-url]: https://david-dm.org/nuintun/file-send
[npm-image]: http://img.shields.io/npm/v/file-send.svg?style=flat-square
[npm-url]: https://www.npmjs.org/package/file-send
[download-image]: http://img.shields.io/npm/dm/file-send.svg?style=flat-square
