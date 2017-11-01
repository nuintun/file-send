'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const holding = require('holding');
const destroy = require('destroy');
const through = require('./through');
const parseURL = require('url').parse;
const expect = require('chai').expect;
const request = require('superagent');
const FileSend = require('../dist/index');

function pathname(url) {
  return parseURL(url).pathname;
}

// test server
const dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/;
const fixtures = path.join(__dirname, 'fixtures');
const server = http.createServer((req, res) => {
  new FileSend(req, pathname(req.url), { root: fixtures })
    .on('dir', function(realpath, next) {
      this.status(403);

      next(this.statusMessage);
    })
    .on('end', function() {})
    .pipe(res);
}).listen();

function url(server, url) {
  let address = server.address();

  if (!address) {
    server.listen();

    address = server.address();
  }

  const port = address.port;
  const protocol = server instanceof http.Server ? 'http' : 'https';

  return protocol + '://127.0.0.1:' + port + url;
}

describe('FileSend(req, path, options)', () => {
  it('should stream the file contents', (done) => {
    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('content-length', '4');

        done();
      });
  });

  it('should stream a zero-length file', (done) => {
    request
      .get(url(server, '/empty.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('');
        expect(res.headers).to.have.ownProperty('content-length', '0');

        done();
      });
  });

  it('should decode the given path as a URI', (done) => {
    request
      .get(url(server, '/some%20thing.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('hey');

        done();
      });
  });

  it('should serve files with dots in name', (done) => {
    request
      .get(url(server, '/do..ts.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('...');

        done();
      });
  });

  it('should treat a malformed URI as a bad request', (done) => {
    request
      .get(url(server, '/some%99thing.txt'))
      .end((err, res) => {
        // console.log(res.text);
        expect(res.badRequest).to.be.true;

        done();
      });
  });

  it('should 400 on NULL bytes', (done) => {
    request
      .get(url(server, '/some%00thing.txt'))
      .end((err, res) => {
        expect(res.badRequest).to.be.true;

        done();
      });
  });

  it('should treat an ENAMETOOLONG as a 404', (done) => {
    var path = '/' + new Array(100).join('foobar');

    request
      .get(url(server, path))
      .end((err, res) => {
        expect(res.notFound).to.be.true;

        done();
      });
  });

  it('should handle headers already sent error', (done) => {
    const cb = holding(2, done);

    let server = http.createServer(function(req, res) {
      res.write('0');
      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/nums'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });

    server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .on('error', function(error, next) {
          this.status(404);
          res.write('0');
          next();
        })
        .pipe(res);
    });

    request
      .get(url(server, '/nums__xxx_no_exist'))
      .end((err, res) => {
        expect(res.notFound).to.be.true;
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });

    server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .on('dir', function(realpath, next) {
          this.status(403);

          res.write('0');
          next();
        })
        .pipe(res);
    });

    request
      .get(url(server, '/pets/'))
      .end((err, res) => {
        expect(res.forbidden).to.be.true;
        expect(res.text).to.equal('0Can\'t set headers after they are sent.');

        cb();
      });
  });

  it('should support other http method', (done) => {
    const methods = ['head', 'post', 'put', 'del'];
    const cb = holding(methods.length - 1, done);

    methods.forEach((method) => {
      request
        [method](url(server, '/name.txt'))
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.headers).to.have.ownProperty('content-length', '4');
          expect(res.text).to.equal(method === 'head' ? undefined : 'tobi');

          cb();
        });
    });
  });

  it('should add an ETag header field', (done) => {
    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('etag');

        done();
      });
  });

  it('should add a Date header field', (done) => {
    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers['date']).to.match(dateRegExp);

        done();
      });
  });

  it('should add a Last-Modified header field', (done) => {
    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers['last-modified']).to.match(dateRegExp);

        done();
      });
  });

  it('should add a Accept-Ranges header field', (done) => {
    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('accept-ranges', 'bytes');

        done();
      });
  });

  it('should 404 if the file does not exist', (done) => {
    request
      .get(url(server, '/meow'))
      .end((err, res) => {
        expect(res.notFound).to.be.true;

        done();
      });
  });

  it('should 404 if the file with trailing slash', (done) => {
    request
      .get(url(server, '/nums/'))
      .end((err, res) => {
        expect(res.notFound).to.be.true;

        done();
      });
  });

  it('should 301 if the directory exists', (done) => {
    request
      .get(url(server, '/pets'))
      .redirects(0)
      .end((err, res) => {
        expect(res.status).to.equal(301);
        expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');

        done();
      });
  });

  it('should not override content-type', (done) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/x-custom');
      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/nums'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('content-type', 'application/x-custom');

        done();
      });
  });

  it('should set Content-Type via mime map', (done) => {
    const cb = holding(1, done);

    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('content-type', 'text/plain');

        cb();
      });

    request
      .get(url(server, '/zip.zip'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.have.ownProperty('content-type', 'application/zip');

        cb();
      });
  });

  it('should 404 if the directory not exists', (done) => {
    request
      .get(url(server, '/what/'))
      .end((err, res) => {
        expect(res.notFound).to.be.true;

        done();
      });
  });

  it('should 403 if the directory exists', (done) => {
    request
      .get(url(server, '/name.d/'))
      .end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
  });

  it('should 404 if file disappears after stat, before open', (done) => {
    const server = http.createServer(function(req, res) {
      const send = new FileSend(req, pathname(req.url), { root: fixtures });

      send.realpath += '__xxx_no_exist';

      send.pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.notFound).to.be.true;

        done();
      });
  });

  it('should 500 on file stream error', (done) => {
    const cb = holding(1, done);

    let server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .use(through((chunk, enc, next) => {
          // simulate file error
          process.nextTick(() => {
            next(new Error('boom!'));
          });
        }))
        .pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(500);

        cb();
      });

    server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .use(through((chunk, enc, next) => {
          // simulate file error
          next(new Error());
        }))
        .pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(500);

        cb();
      });
  });

  it('should not overwrite custom Cache-Control', (done) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-store');

      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request
      .get(url(server, '/name.txt'))
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'no-store');

        done();
      });
  });

  describe('headers event', () => {
    it('should fire when sending file', (done) => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        res.setHeader('Cache-Control', 'private');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('ETag', '"9-150f5bc45c8"');
        res.setHeader('Last-Modified', 'Wed, 11 Nov 2015 08:49:28 GMT');

        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('headers', function() {
            this.setHeader('X-Powered-By', 'Node-' + process.version.toUpperCase());
            this.setHeader('Server', 'file-send');
            this.removeHeader('X-Powered-By');

            cb();
          })
          .pipe(res);
      });

      request
        .get(url(server, '/nums'))
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.have.ownProperty('server', 'file-send');

          cb();
        });
    });

    it('should fire on 404', (done) => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('headers', function() {
            this.setHeader('Server', 'file-send');
            cb();
          })
          .pipe(res);
      });

      request
        .get(url(server, '/bogus'))
        .end((err, res) => {
          expect(res.notFound).to.be.true;
          expect(res.headers).to.have.ownProperty('server', 'file-send');

          cb();
        });
    });

    it('should fire on index', (done) => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures, index: ['index.html'] })
          .on('headers', function() {
            this.setHeader('Server', 'file-send');
            cb();
          })
          .pipe(res);
      });

      request
        .get(url(server, '/pets/'))
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.have.string('tobi');
          expect(res.headers).to.have.ownProperty('server', 'file-send');

          cb();
        });
    });

    it('should fire on redirect', (done) => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('headers', function() {
            this.setHeader('Server', 'file-send');
            cb();
          })
          .pipe(res);
      });

      request
        .get(url(server, '/pets'))
        .redirects(0)
        .end((err, res) => {
          expect(res.status).to.equal(301);
          expect(res.headers).to.have.ownProperty('location', '/pets/');
          expect(res.headers).to.have.ownProperty('server', 'file-send');

          cb();
        });
    });

    it('should allow altering headers', (done) => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('headers', headers)
          .pipe(res);
      });

      function headers() {
        this.setHeader('Cache-Control', 'no-cache');
        this.setHeader('Content-Type', 'text/x-custom');
        this.setHeader('ETag', 'W/"everything"');
        this.setHeader('X-Created', fs.statSync(this.realpath).ctime.toUTCString());

        cb();
      }

      request
        .get(url(server, '/nums'))
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('123456789');
          expect(res.headers).to.have.ownProperty('cache-control', 'no-cache');
          expect(res.headers).to.have.ownProperty('content-type', 'text/x-custom');
          expect(res.headers).to.have.ownProperty('etag', 'W/"everything"');
          expect(res.headers['x-created']).to.match(dateRegExp);

          cb();
        });
    });
  });

  describe('when no "dir" listeners are present', () => {
    let server;

    before(function() {
      server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
      });

      server.listen();
    });

    it('should default with 403', (done) => {
      request
        .get(url(server, '/pets/'))
        .end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
    });

    it('should not redirect to protocol-relative locations', (done) => {
      request
        .get(url(server, '//pets'))
        .redirects(0)
        .end((err, res) => {
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');
          expect(res.headers).to.have.ownProperty('location', '/pets/');
          expect(res.headers).to.have.ownProperty('content-type', 'text/html; charset=UTF-8');

          done();
        });
    });

    it('should respond with an HTML redirect', (done) => {
      const cb = holding(1, done);

      request
        .get(url(server, '/pets'))
        .redirects(0)
        .end((err, res) => {
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');
          expect(res.headers).to.have.ownProperty('location', '/pets/');
          expect(res.headers).to.have.ownProperty('content-type', 'text/html; charset=UTF-8');

          cb();
        });

      const snow = http.createServer((req, res) => {
        req.url = '/snow ☃';
        new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
      });

      snow.listen();

      request
        .get(url(snow, '/snow'))
        .redirects(0)
        .end((err, res) => {
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/snow%20%E2%98%83/">/snow ☃/</a>');
          expect(res.headers).to.have.ownProperty('location', '/snow%20%E2%98%83/');
          expect(res.headers).to.have.ownProperty('content-type', 'text/html; charset=UTF-8');

          cb();
        });
    });
  });
});
