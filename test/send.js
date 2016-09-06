var fs = require('fs');
var http = require('http');
var path = require('path');
var after = require('after');
var Send = require('../index');
var destroy = require('destroy');
var util = require('../lib/util');
var through = require('../lib/through');
var https = require('https');
var expect = require('chai').expect;
var request = require('superagent');

// hit test-cli line
through().destroy();

// hit test-cli line
util.isType(NaN, 'nan');

// hit test-cli line
try {
  Send(null);
} catch (e) {
  // error
}

// test server
var dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/;
var fixtures = path.join(__dirname, 'fixtures');
var server = http.createServer(function (req, res){
  Send(req, { root: fixtures })
    .on('dir', function (realpath, stats, next){
      this.status(res, 403);
      next(this.statusMessage);
    })
    .on('finish', function (){ })
    .pipe(res);
});

server.listen();

function createServer(root, opts){
  opts = opts || {};
  opts.root = root;

  return http.createServer(function onRequest(req, res){
    try {
      Send(req, opts).pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });
}

function url(server, url){
  var port;
  var protocol;
  var address = server.address();

  if (!address) {
    server.listen();

    address = server.address();
  }

  port = address.port;
  protocol = server instanceof https.Server ? 'https' : 'http';

  return protocol + '://127.0.0.1:' + port + url;
}

describe('Send(req, options)', function (){
  it('should stream the file contents', function (done){
    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.property('content-length', '4');

        done();
      });
  });

  it('should stream a zero-length file', function (done){
    request
      .get(url(server, '/empty.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('');
        expect(res.headers).to.have.property('content-length', '0');

        done();
      });
  });

  it('should decode the given path as a URI', function (done){
    request
      .get(url(server, '/some%20thing.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('hey');

        done();
      });
  });

  it('should serve files with dots in name', function (done){
    request
      .get(url(server, '/do..ts.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('...');

        done();
      });
  });

  it('should treat a malformed URI as a bad request', function (done){
    request
      .get(url(server, '/some%99thing.txt'))
      .end(function (err, res){
        expect(res.badRequest).to.be.true;
        expect(res.text).to.equal('Bad Request');

        done();
      });
  });

  it('should 400 on NULL bytes', function (done){
    request
      .get(url(server, '/some%00thing.txt'))
      .end(function (err, res){
        expect(res.badRequest).to.be.true;
        expect(res.text).to.equal('Bad Request');

        done();
      });
  });

  it('should treat an ENAMETOOLONG as a 404', function (done){
    var path = '/' + new Array(100).join('foobar');

    request
      .get(url(server, path))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('Not Found');

        done();
      });
  });

  it('should handle headers already sent error', function (done){
    var cb = after(3, done);
    var server = http.createServer(function (req, res){
      res.write('0');
      Send(req, { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/nums'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });

    server = http.createServer(function (req, res){
      Send(req, { root: fixtures })
        .on('error', function (error, next){
          this.status(res, 404);
          res.write('0');
          next();
        })
        .pipe(res);
    });

    request
      .get(url(server, '/nums__xxx_no_exist'))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });

    server = http.createServer(function (req, res){
      Send(req, { root: fixtures })
        .on('dir', function (realpath, stats, next){
          this.status(res, 403);
          res.write('0');
          next();
        })
        .pipe(res);
    });

    request
      .get(url(server, '/pets/'))
      .end(function (err, res){
        expect(res.forbidden).to.be.true;
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });
  });

  it('should support other http method', function (done){
    var methods = ['head', 'post', 'put', 'del'];
    var cb = after(methods.length, done);

    methods.forEach(function (method){
      request
        [method](url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.headers).to.have.property('content-length', '4');
          expect(res.text).to.equal(method === 'head' ? undefined : 'tobi');

          cb();
        });
    });
  });

  it('should add an ETag header field', function (done){
    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('etag');

        done();
      });
  });

  it('should add a Date header field', function (done){
    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers['date']).to.match(dateRegExp);

        done();
      });
  });

  it('should add a Last-Modified header field', function (done){
    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers['last-modified']).to.match(dateRegExp);

        done();
      });
  });

  it('should add a Accept-Ranges header field', function (done){
    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.property('accept-ranges', 'bytes');

        done();
      });
  });

  it('should 404 if the file does not exist', function (done){
    request
      .get(url(server, '/meow'))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('Not Found');

        done();
      });
  });

  it('should 404 if the file with trailing slash', function (done){
    request
      .get(url(server, '/nums/'))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('Not Found');

        done();
      });
  });

  it('should 301 if the directory exists', function (done){
    request
      .get(url(server, '/pets'))
      .redirects(0)
      .end(function (err, res){
        expect(res.status).to.equal(301);
        expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');

        done();
      });
  });

  it('should not override content-type', function (done){
    var server = http.createServer(function (req, res){
      res.setHeader('Content-Type', 'application/x-custom');
      Send(req, { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/nums'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.property('content-type', 'application/x-custom');

        done();
      });
  });

  it('should set Content-Type via mime map', function (done){
    var cb = after(2, done);

    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.property('content-type', 'text/plain');

        cb();
      });

    request
      .get(url(server, '/zip.zip'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.property('content-type', 'application/zip');

        cb();
      });
  });

  it('should 404 if the directory not exists', function (done){
    request
      .get(url(server, '/what/'))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('Not Found');

        done();
      });
  });

  it('should 403 if the directory exists', function (done){
    request
      .get(url(server, '/name.d/'))
      .end(function (err, res){
        expect(res.forbidden).to.be.true;
        expect(res.text).to.equal('Forbidden');

        done();
      });
  });

  it('should 404 if file disappears after stat, before open', function (done){
    var path = require('path');
    var SEP = path.sep;
    var join = path.join;
    var resolve = path.resolve;
    var parseUrl = require('url').parse;
    var server = http.createServer(function (req, res){
      function SubSend(request, options){
        if (!(this instanceof SubSend)) {
          return new SubSend(request, options);
        }

        if (!(request instanceof http.IncomingMessage)) {
          throw new TypeError('The first argument must be a http request.');
        }

        options = options || {};

        this.headers = {};
        this.ranges = [];
        this.request = request;
        this.method = this.request.method;
        this.charset = util.isType(options.charset, 'string')
          ? options.charset
          : null;
        this.glob = options.glob || {};

        if (!this.glob.hasOwnProperty('dot')) {
          this.glob.dot = true;
        }

        // variable declaration
        var url, path, realpath, root, etag, ignore,
          ignoreAccess, maxAge, lastModified, index, stream;

        // url
        Object.defineProperty(this, 'url', {
          enumerable: true,
          get: function (){
            if (!url) {
              url = util.decodeURI(request.url);
              url = url === -1 ? url : util.normalize(url);
            }

            return url;
          }
        });

        // root
        Object.defineProperty(this, 'root', {
          enumerable: true,
          get: function (){
            if (!root) {
              root = util.isType(options.root, 'string')
                ? resolve(options.root)
                : CWD;

              root = util.posixPath(join(root, SEP));
            }

            return root;
          }
        });

        // parsed url
        Object.defineProperty(this, '_url', {
          value: this.url === -1
            ? {}
            : parseUrl(this.url, options.parseQueryString, options.slashesDenoteHost)
        });

        // path
        Object.defineProperty(this, 'path', {
          enumerable: true,
          get: function (){
            if (!path) {
              path = this.url === -1
                ? this.url
                : util.decodeURI(this._url.pathname);
            }

            return path;
          }
        });

        // real path
        Object.defineProperty(this, 'realpath', {
          enumerable: true,
          set: function (value){
            realpath = value;
          },
          get: function (){
            if (!realpath) {
              realpath = this.path === -1
                ? this.path
                : util.posixPath(join(this.root, this.path));
            }

            return realpath;
          }
        });

        // query
        Object.defineProperty(this, 'query', {
          enumerable: true,
          value: this._url.query
        });

        // etag
        Object.defineProperty(this, 'etag', {
          enumerable: true,
          get: function (){
            if (!etag) {
              etag = options.etag !== undefined
                ? Boolean(options.etag)
                : true;
            }

            return etag;
          }
        });

        // ignore
        Object.defineProperty(this, 'ignore', {
          enumerable: true,
          get: function (){
            if (!ignore) {
              ignore = Array.isArray(options.ignore)
                ? options.ignore
                : [options.ignore];

              ignore = ignore.filter(function (pattern){
                return pattern
                  && (util.isType(pattern, 'string')
                  || util.isType(pattern, 'regexp')
                  || util.isType(pattern, 'function'));
              });
            }

            return ignore;
          }
        });

        // ignore-access
        Object.defineProperty(this, 'ignoreAccess', {
          enumerable: true,
          get: function (){
            if (!ignoreAccess) {
              switch (options.ignoreAccess) {
                case 'deny':
                case 'ignore':
                  ignoreAccess = options.ignoreAccess;
                  break;
                default:
                  ignoreAccess = 'deny';
              }
            }

            return ignoreAccess;
          }
        });

        // max-age
        Object.defineProperty(this, 'maxAge', {
          enumerable: true,
          get: function (){
            if (!maxAge) {
              maxAge = util.isType(options.maxAge, 'string')
                ? ms(options.maxAge) / 1000
                : Number(options.maxAge);

              maxAge = !isNaN(maxAge)
                ? Math.min(Math.max(0, maxAge), MAXMAXAGE)
                : 0;

              maxAge = Math.floor(maxAge);
            }

            return maxAge;
          }
        });

        // last-modified
        Object.defineProperty(this, 'lastModified', {
          enumerable: true,
          get: function (){
            if (!lastModified) {
              lastModified = options.lastModified !== undefined
                ? Boolean(options.lastModified)
                : true;
            }

            return lastModified;
          }
        });

        // last-modified
        Object.defineProperty(this, 'index', {
          enumerable: true,
          get: function (){
            if (!index) {
              index = Array.isArray(options.index)
                ? options.index
                : [options.index];

              index = index.filter(function (index){
                return index && util.isType(index, 'string');
              });
            }

            return index;
          }
        });

        // stream
        Object.defineProperty(this, 'stream', {
          value: through(),
          writable: true,
          enumerable: false
        });

        // pipe returned stream
        Object.defineProperty(this, '_stream', {
          enumerable: false,
          set: function (value){
            stream = value;
          },
          get: function (){
            return stream || this.stream;
          }
        });

        // headers names
        Object.defineProperty(this, 'headerNames', {
          value: {},
          writable: true,
          enumerable: false
        });

        // path has trailing slash
        Object.defineProperty(this, 'hasTrailingSlash', {
          value: this.path === -1 ? false : this.path.slice(-1) === '/'
        });
      }

      SubSend.prototype = Object.create(Send.prototype, {
        constructor: { value: SubSend }
      });

      var send = SubSend(req, { root: fixtures });
      var fn = send.createReadStream;

      // simulate file ENOENT after on open, after stat
      send.createReadStream = function (response){
        this.realpath += '__xxx_no_exist';

        fn.apply(this, arguments);
      };

      send.pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('Not Found');

        done();
      });
  });

  it('should 500 on file stream error', function (done){
    var cb = after(2, done);
    var server = http.createServer(function (req, res){
      Send(req, { root: fixtures })
        .pipe(through(function (chunk, enc, next){
          // simulate file error
          process.nextTick(function (){
            next(new Error('boom!'));
          });
        }))
        .pipe(through())
        .pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(500);
        expect(res.text).to.equal('boom!');

        cb();
      });

    server = http.createServer(function (req, res){
      Send(req, { root: fixtures })
        .pipe(through(function (chunk, enc, next){
          // simulate file error
          next(new Error());
        }))
        .pipe(through())
        .pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(500);
        expect(res.text).to.equal('Internal Server Error');

        cb();
      });
  });

  it('should not overwrite custom Cache-Control', function (done){
    var server = http.createServer(function (req, res){
      res.setHeader('Cache-Control', 'no-store');

      Send(req, { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end(function (err, res){
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.property('cache-control', 'no-store');

        done();
      });
  });

  describe('headers event', function (){
    it('should fire when sending file', function (done){
      var cb = after(2, done);
      var server = http.createServer(function (req, res){
        res.setHeader('Cache-Control', 'private');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('ETag', '"9-150f5bc45c8"');
        res.setHeader('Last-Modified', 'Wed, 11 Nov 2015 08:49:28 GMT');

        Send(req, { root: fixtures })
          .on('headers', function (){
            this.setHeader('X-Powered-By', 'Node-' + process.version.toUpperCase());
            this.setHeader('Server', 'Nengine');
            this.removeHeader('X-Powered-By');
            cb();
          })
          .pipe(res);
      });

      request
        .get(url(server, '/nums'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.have.property('server', 'Nengine');

          cb();
        });
    });

    it('should fire on 404', function (done){
      var cb = after(2, done);
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .on('headers', function (){ cb(); })
          .pipe(res);
      });

      request
        .get(url(server, '/bogus'))
        .end(function (err, res){
          expect(res.notFound).to.be.true;
          expect(res.text).to.equal('Not Found');

          cb();
        });
    });

    it('should fire on index', function (done){
      var cb = after(3, done);
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['index.html'] })
          .on('headers', function (){ cb(); })
          .pipe(res);
      });

      request
        .get(url(server, '/pets/'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.have.string('tobi');

          cb();
        });
    });

    it('should fire on redirect', function (done){
      var cb = after(2, done);
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .on('headers', function (){ cb(); })
          .pipe(res);
      });

      request
        .get(url(server, '/pets'))
        .redirects(0)
        .end(function (err, res){
          expect(res.status).to.equal(301);
          expect(res.headers).to.have.property('location', '/pets/');

          cb();
        });
    });

    it('should allow altering headers', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .on('headers', headers)
          .pipe(res);
      });

      function headers(){
        this.setHeader('Cache-Control', 'no-cache');
        this.setHeader('Content-Type', 'text/x-custom');
        this.setHeader('ETag', 'W/"everything"');
        this.setHeader('X-Created', fs.statSync(this.realpath).ctime.toUTCString());
      }

      request
        .get(url(server, '/nums'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.have.property('cache-control', 'no-cache');
          expect(res.headers).to.have.property('content-type', 'text/x-custom');
          expect(res.headers).to.have.property('etag', 'W/"everything"');
          expect(res.headers['x-created']).to.match(dateRegExp);

          done();
        });
    });
  });

  describe('when no "dir" listeners are present', function (){
    var server;

    before(function (){
      server = http.createServer(function (req, res){
        Send(req, { root: fixtures }).pipe(res);
      });

      server.listen();
    });

    it('should default with 403', function (done){
      request
        .get(url(server, '/pets/'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          done();
        });
    });

    it('should not redirect to protocol-relative locations', function (done){
      request
        .get(url(server, '//pets'))
        .redirects(0)
        .end(function (err, res){
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');
          expect(res.headers).to.have.property('location', '/pets/');
          expect(res.headers).to.have.property('content-type', 'text/html; charset=UTF-8');

          done();
        });
    });

    it('should respond with an HTML redirect', function (done){
      var cb = after(2, done);

      request
        .get(url(server, '/pets'))
        .redirects(0)
        .end(function (err, res){
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');
          expect(res.headers).to.have.property('location', '/pets/');
          expect(res.headers).to.have.property('content-type', 'text/html; charset=UTF-8');

          cb();
        });

      var snow = http.createServer(function (req, res){
        req.url = '/snow ☃';
        Send(req, { root: fixtures }).pipe(res);
      });

      snow.listen();

      request
        .get(url(snow, '/snow'))
        .redirects(0)
        .end(function (err, res){
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/snow%20%E2%98%83/">/snow ☃/</a>');
          expect(res.headers).to.have.property('location', '/snow%20%E2%98%83/');
          expect(res.headers).to.have.property('content-type', 'text/html; charset=UTF-8');

          cb();
        });
    });
  });

  describe('when no "error" listeners are present', function (){
    it('should respond to errors directly', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: 'test/fixtures' + req.url }).pipe(res);
      });

      request
        .get(url(server, '/pets'))
        .end(function (err, res){
          expect(res.notFound).to.be.true;
          expect(res.text).to.equal('Not Found');

          done();
        });
    })
  });

  describe('with conditional-GET', function (){
    it('should respond with 304 on a match', function (done){
      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-None-Match', res.headers['etag'])
            .set('If-Modified-Since', res.headers['last-modified'])
            .end(function (err, res){
              expect(res.status).to.equal(304);

              done();
            });
        });
    });

    it('should respond with 200 otherwise', function (done){
      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-None-Match', '"123"')
            .end(function (err, res){
              expect(res.status).to.equal(200);
              expect(res.text).to.equal('tobi');

              done();
            });
        });
    });
  });

  describe('with range request', function (){
    it('should support byte ranges', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-4')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('12345');
          expect(res.headers).to.have.property('content-range', 'bytes 0-4/9');

          done();
        });
    });

    it('should be inclusive', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-0')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('1');
          expect(res.headers).to.have.property('content-range', 'bytes 0-0/9');

          done();
        });
    });

    it('should set Content-Range', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=2-5')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('3456');
          expect(res.headers).to.have.property('content-range', 'bytes 2-5/9');

          done();
        });
    });

    it('should support -n', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=-3')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('789');
          expect(res.headers).to.have.property('content-range', 'bytes 6-8/9');

          done();
        });
    });

    it('should support n-', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=3-')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('456789');
          expect(res.headers).to.have.property('content-range', 'bytes 3-8/9');

          done();
        });
    });

    it('should respond with 206 "Partial Content"', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-4')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('12345');
          expect(res.headers).to.have.property('content-range', 'bytes 0-4/9');

          done();
        });
    });

    it('should set Content-Length to the # of octets transferred', function (done){
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=2-3')
        .end(function (err, res){
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('34');
          expect(res.headers).to.have.property('content-length', '2');
          expect(res.headers).to.have.property('content-range', 'bytes 2-3/9');

          done();
        });
    });

    describe('when last-byte-pos of the range is greater the length', function (){
      it('is taken to be equal to one less than the length', function (done){
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=2-50')
          .end(function (err, res){
            expect(res.status).to.equal(206);
            expect(res.text).to.equal('3456789');
            expect(res.headers).to.have.property('content-range', 'bytes 2-8/9');

            done();
          });
      });

      it('should adapt the Content-Length accordingly', function (done){
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=2-50')
          .end(function (err, res){
            expect(res.status).to.equal(206);
            expect(res.text).to.equal('3456789');
            expect(res.headers).to.have.property('content-length', '7');
            expect(res.headers).to.have.property('content-range', 'bytes 2-8/9');

            done();
          });
      });
    });

    describe('when the first- byte-pos of the range is greater length', function (){
      it('should respond with 416', function (done){
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=9-50')
          .end(function (err, res){
            expect(res.status).to.equal(416);
            expect(res.text).to.include('Range Not Satisfiable');

            done();
          });
      });
    });

    describe('when syntactically invalid', function (){
      it('should respond with 200 and the entire contents', function (done){
        request
          .get(url(server, '/nums'))
          .set('Range', 'asdf')
          .end(function (err, res){
            expect(res.status).to.equal(200);
            expect(res.text).to.equal('123456789');

            done();
          });
      });
    });

    describe('when multiple ranges', function (){
      it('should respond with 206 and the range contents', function (done){
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=1-1,3-')
          .end(function (err, res){
            expect(res.status).to.equal(206);
            expect(res.headers['content-type']).to.match(/^multipart\/byteranges; boundary=<[^<>]+>$/);

            done();
          });
      });
    });

    describe('when if-range present', function (){
      it('should respond with parts when etag unchanged', function (done){
        request
          .get(url(server, '/nums'))
          .end(function (err, res){
            expect(res.status).to.equal(200);

            var etag = res.headers['etag'];

            request
              .get(url(server, '/nums'))
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .end(function (err, res){
                expect(res.status).to.equal(206);
                expect(res.text).to.equal('1');

                done();
              });
          });
      });

      it('should respond with 200 when etag changed', function (done){
        request
          .get(url(server, '/nums'))
          .end(function (err, res){
            expect(res.status).to.equal(200);

            var etag = res.headers['etag'].replace(/"(.)/, '"0$1');

            request
              .get(url(server, '/nums'))
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .end(function (err, res){
                expect(res.status).to.equal(200);
                expect(res.text).to.equal('123456789');

                done();
              });
          });
      });

      it('should respond with parts when modified unchanged', function (done){
        request
          .get(url(server, '/nums'))
          .end(function (err, res){
            expect(res.status).to.equal(200);

            var modified = res.headers['last-modified'];

            request
              .get(url(server, '/nums'))
              .set('If-Range', modified)
              .set('Range', 'bytes=0-0')
              .end(function (err, res){
                expect(res.status).to.equal(206);
                expect(res.text).to.equal('1');

                done();
              });
          });
      });

      it('should respond with 200 when modified changed', function (done){
        request
          .get(url(server, '/nums'))
          .end(function (err, res){
            expect(res.status).to.equal(200);

            var modified = Date.parse(res.headers['last-modified']) - 20000;

            request
              .get(url(server, '/nums'))
              .set('If-Range', new Date(modified).toUTCString())
              .set('Range', 'bytes=0-0')
              .end(function (err, res){
                expect(res.status).to.equal(200);
                expect(res.text).to.equal('123456789');

                done();
              });
          });
      });
    });
  });
});

describe('Options', function (){
  describe('root', function (){
    it('should join root', function (done){
      request
        .get(url(createServer(fixtures), '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          done();
        });
    });

    it('should work with trailing slash', function (done){
      request
        .get(url(createServer(fixtures + '/'), '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          done();
        });
    });

    it('should restrict paths to within root', function (done){
      request
        .get(url(createServer(fixtures), '/pets/../../index.js'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          done();
        });
    });

    it('should allow .. in root', function (done){
      request
        .get(url(createServer(__dirname + '/fixtures/../fixtures'), '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          done();
        });
    });

    it('should not allow root transversal', function (done){
      request
        .get(url(createServer(__dirname + '/fixtures/name.d'), '/../name.dir/name.txt'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          done();
        });
    });
  });

  describe('etag', function (){
    it('should support disabling etags', function (done){
      request
        .get(url(createServer(fixtures, { 'etag': false }), '/nums'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.not.have.ownProperty('etag');

          done();
        });
    });
  });

  describe('charset', function (){
    it('should default no charset', function (done){
      request
        .get(url(server, '/tobi.html'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('<p>tobi</p>');
          expect(res.headers['content-type']).to.not.include('charset');

          done();
        });
    });

    it('should can set charset', function (done){
      request
        .get(url(createServer(fixtures, { 'charset': 'utf-8' }), '/tobi.html'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('<p>tobi</p>');
          expect(res.headers['content-type']).to.include('charset=utf-8');

          done();
        });
    });
  });

  describe('ignore', function (){
    it('should default no ignore', function (done){
      var cb = after(2, done);
      var server = createServer(fixtures);

      server.listen();

      request
        .get(url(server, '/.hidden'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('secret\n');

          cb();
        });

      request
        .get(url(server, '/.mine/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          cb();
        });
    });

    it('should can ignore match', function (done){
      var cb = after(2, done);
      var server = createServer(fixtures, { ignore: ['/**/.*?(/*.*|/)'] });

      server.listen();

      request
        .get(url(server, '/.hidden'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          cb();
        });

      request
        .get(url(server, '/.mine/name.txt'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          cb();
        });
    });
  });

  describe('ignoreAccess', function (){
    describe('should default to "deny"', function (){
      var server = createServer(fixtures, { ignore: ['/**/.*?(/*.*|/)'] });

      server.listen();

      it('should 403 for ignore', function (done){
        request
          .get(url(server, '/.hidden'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should 403 for ignore directory', function (done){
        request
          .get(url(server, '/.mine'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should 403 for ignore directory with trailing slash', function (done){
        request
          .get(url(server, '/.mine/'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should 403 for file within ignore directory', function (done){
        request
          .get(url(server, '/.mine/name.txt'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should 403 for non-existent ignore', function (done){
        request
          .get(url(server, '/.nothere'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should 403 for non-existent ignore directory', function (done){
        request
          .get(url(server, '/.what/name.txt'))
          .end(function (err, res){
            expect(res.forbidden).to.be.true;
            expect(res.text).to.equal('Forbidden');

            done();
          });
      });

      it('should skip ignore index', function (done){
        var cb = after(2, done);
        var server = http.createServer(function (req, res){
          Send(req, {
            root: fixtures,
            index: ['name.txt', 'name.html'],
            ignore: ['/**/name.txt']
          }).on('headers', function (){
            cb();
          }).pipe(res);
        });

        request
          .get(url(server, '/'))
          .end(function (err, res){
            expect(res.status).to.equal(200);
            expect(res.text).to.equal('<p>tobi</p>');

            cb();
          });
      });

      it('should send files in root ignore directory', function (done){
        var root = path.join(fixtures, '.mine');

        request
          .get(url(createServer(root, { ignore: ['/**/.*?(/*.*|/)'] }), '/name.txt'))
          .end(function (err, res){
            expect(res.status).to.equal(200);
            expect(res.text).to.equal('tobi');

            done();
          });
      });
    });

    describe('when "ignore"', function (){
      var options = { ignore: ['/**/.*?(/*.*|/)'], ignoreAccess: 'ignore' };
      var server = createServer(fixtures, options);

      server.listen();

      it('should 404 for ignore', function (done){
        request
          .get(url(server, '/.hidden'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should 404 for ignore directory', function (done){
        request
          .get(url(server, '/.mine'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should 404 for ignore directory with trailing slash', function (done){
        request
          .get(url(server, '/.mine/'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should 404 for file within ignore directory', function (done){
        request
          .get(url(server, '/.mine/name.txt'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should 404 for non-existent ignore', function (done){
        request
          .get(url(server, '/.nothere'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should 404 for non-existent ignore directory', function (done){
        request
          .get(url(server, '/.what/name.txt'))
          .end(function (err, res){
            expect(res.notFound).to.be.true;
            expect(res.text).to.equal('Not Found');

            done();
          });
      });

      it('should send files in root ignore directory', function (done){
        var root = path.join(fixtures, '.mine');
        var options = { ignore: ['/**/.*?(/*.*|/)'], ignoreAccess: 'ignore' };
        var server = createServer(root, options);

        request
          .get(url(server, '/name.txt'))
          .end(function (err, res){
            expect(res.status).to.equal(200);
            expect(res.text).to.equal('tobi');

            done();
          });
      });
    });
  });

  describe('index', function (){
    it('should default no index', function (done){
      request
        .get(url(server, '/pets/'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          done();
        });
    });

    it('should be configurable', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: 'tobi.html' })
          .pipe(res);
      });

      request
        .get(url(server, '/'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('<p>tobi</p>');

          done();
        });
    });

    it('should support disabling', function (done){
      var server = createServer(fixtures, { index: false });

      request
        .get(url(server, '/pets/'))
        .end(function (err, res){
          expect(res.forbidden).to.be.true;
          expect(res.text).to.equal('Forbidden');

          done();
        });
    });

    it('should support fallbacks', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['default.htm', 'index.html'] })
          .pipe(res);
      });

      request
        .get(url(server, '/pets/'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.include('tobi');

          done();
        });
    });

    it('should not follow directories', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['pets', 'name.txt'] })
          .pipe(res);
      });

      request
        .get(url(server, '/'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.include('tobi');

          done();
        });
    });
  });

  describe('lastModified', function (){
    it('should support disabling last-modified', function (done){
      var server = createServer(fixtures, { lastModified: false });

      request
        .get(url(server, '/nums'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.not.have.ownProperty('last-modified');

          done();
        });
    })
  });

  describe('maxAge', function (){
    it('should default to disabled', function (done){
      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');
          expect(res.headers).to.not.have.property('cache-control');

          done();
        });
    });

    it('should floor to integer', function (done){
      var server = createServer(fixtures, { maxAge: 123.956 });

      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');
          expect(res.headers).to.have.property('cache-control', 'max-age=123');

          done();
        });
    });

    it('should accept string', function (done){
      var server = createServer(fixtures, { maxAge: '30d' });

      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');
          expect(res.headers).to.have.property('cache-control', 'max-age=2592000');

          done();
        });
    });

    it('should max at 1 year', function (done){
      var server = createServer(fixtures, { maxAge: Infinity });

      request
        .get(url(server, '/name.txt'))
        .end(function (err, res){
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');
          expect(res.headers).to.have.property('cache-control', 'max-age=31536000');

          done();
        });
    });
  });
});
