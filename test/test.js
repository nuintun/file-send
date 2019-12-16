'use strict';

const path = require('path');
const http = require('http');
const FileSend = require('../index');
const through = require('./through');
const request = require('superagent');
const parseURL = require('url').parse;
const expect = require('chai').expect;
const holding = require('holding').assert;

function pathname(url) {
  return parseURL(url).pathname;
}

// test server
const dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/;
const fixtures = path.join(__dirname, 'fixtures');
const server = http
  .createServer((req, res) => {
    new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
  })
  .listen();

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
  it('should stream the file contents', done => {
    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal('tobi');
      expect(res.headers).to.have.ownProperty('content-length', '4');

      done();
    });
  });

  it('should stream a zero-length file', done => {
    request.get(url(server, '/empty.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal('');
      expect(res.headers).to.have.ownProperty('content-length', '0');

      done();
    });
  });

  it('should decode the given path as a URI', done => {
    request.get(url(server, '/some%20thing.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal('hey');

      done();
    });
  });

  it('should serve files with dots in name', done => {
    request.get(url(server, '/do..ts.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal('...');

      done();
    });
  });

  it('should treat a malformed URI as a bad request', done => {
    request.get(url(server, '/some%99thing.txt')).end((err, res) => {
      expect(res.badRequest).to.be.true;

      done();
    });
  });

  it('should 400 on NULL bytes', done => {
    request.get(url(server, '/some%00thing.txt')).end((err, res) => {
      expect(res.badRequest).to.be.true;

      done();
    });
  });

  it('should treat an ENAMETOOLONG as a 404', done => {
    const path = '/' + new Array(100).join('foobar');

    request.get(url(server, path)).end((err, res) => {
      expect(res.notFound).to.be.true;

      done();
    });
  });

  it('should handle headers already sent error', done => {
    const cb = holding(2, done);

    let server = http.createServer((req, res) => {
      res.write('0');
      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request.get(url(server, '/nums')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal("0Can't set headers after they are sent.");

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

    request.get(url(server, '/nums__xxx_no_exist')).end((err, res) => {
      expect(res.notFound).to.be.true;
      expect(res.text).to.equal("0Can't set headers after they are sent.");

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

    request.get(url(server, '/pets/')).end((err, res) => {
      expect(res.forbidden).to.be.true;
      expect(res.text).to.equal("0Can't set headers after they are sent.");

      cb();
    });
  });

  it('should support HEAD', done => {
    request.head(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('content-length', '4');
      expect(res.text).to.be.undefined;

      done();
    });
  });

  it('should respond with 405 on an unsupport http method', done => {
    const methods = ['post', 'put', 'del'];
    const cb = holding(methods.length - 1, done);

    methods.forEach(method => {
      request[method](url(server, '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(405);

        cb();
      });
    });
  });

  it('should respond with 405 on an unsupport http method', done => {
    const methods = ['post', 'put', 'del'];
    const cb = holding(methods.length - 1, done);

    methods.forEach(method => {
      request[method](url(server, '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(405);

        cb();
      });
    });
  });

  it('should add an ETag header field', done => {
    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('etag');

      done();
    });
  });

  it('should add a Date header field', done => {
    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers['date']).to.match(dateRegExp);

      done();
    });
  });

  it('should add a Last-Modified header field', done => {
    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers['last-modified']).to.match(dateRegExp);

      done();
    });
  });

  it('should add a Accept-Ranges header field', done => {
    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('accept-ranges', 'bytes');

      done();
    });
  });

  it('should 404 if the file does not exist', done => {
    request.get(url(server, '/meow')).end((err, res) => {
      expect(res.notFound).to.be.true;

      done();
    });
  });

  it('should 404 if the file with trailing slash', done => {
    request.get(url(server, '/nums/')).end((err, res) => {
      expect(res.notFound).to.be.true;

      done();
    });
  });

  it('should 301 if the directory exists', done => {
    request
      .get(url(server, '/pets'))
      .redirects(0)
      .end((err, res) => {
        expect(res.status).to.equal(301);
        expect(res.text).to.equal('Redirecting to <a href="/pets/">/pets/</a>');

        done();
      });
  });

  it('should not override content-type', done => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/x-custom');
      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request.get(url(server, '/nums')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('content-type', 'application/x-custom');

      done();
    });
  });

  it('should set Content-Type via mime map', done => {
    const cb = holding(1, done);

    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('content-type', 'text/plain');

      cb();
    });

    request.get(url(server, '/zip.zip')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.headers).to.have.ownProperty('content-type', 'application/zip');

      cb();
    });
  });

  it('should 404 if the directory not exists', done => {
    request.get(url(server, '/what/')).end((err, res) => {
      expect(res.notFound).to.be.true;

      done();
    });
  });

  it('should 403 if the directory exists', done => {
    request.get(url(server, '/name.d/')).end((err, res) => {
      expect(res.forbidden).to.be.true;

      done();
    });
  });

  it('should 404 if file disappears after stat, before open', done => {
    const server = http.createServer((req, res) => {
      const send = new FileSend(req, pathname(req.url), { root: fixtures });

      send.on('file', () => {
        send.path += '__xxx_no_exist';
      });

      send.pipe(res);
    });

    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.notFound).to.be.true;

      done();
    });
  });

  it('should 500 on file stream error', done => {
    const cb = holding(1, done);

    let server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .use(
          through((chunk, enc, next) => {
            // simulate file error
            process.nextTick(() => {
              next(new Error('boom!'));
            });
          })
        )
        .pipe(res);
    });

    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(500);

      cb();
    });

    server = http.createServer((req, res) => {
      new FileSend(req, pathname(req.url), { root: fixtures })
        .use(
          through((chunk, enc, next) => {
            // simulate file error
            next(new Error());
          })
        )
        .pipe(res);
    });

    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(500);

      cb();
    });
  });

  it('should not overwrite custom Cache-Control', done => {
    const server = http.createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-store');

      new FileSend(req, pathname(req.url), { root: fixtures }).pipe(res);
    });

    request.get(url(server, '/name.txt')).end((err, res) => {
      expect(res.status).to.equal(200);
      expect(res.text).to.equal('tobi');
      expect(res.headers).to.have.ownProperty('cache-control', 'no-store');

      done();
    });
  });

  describe('when no "dir" listeners are present', () => {
    it('should default with 403', done => {
      request.get(url(server, '/pets/')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
    });

    it('should not redirect to protocol-relative locations', done => {
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

    it('should respond with an HTML redirect', done => {
      request
        .get(url(server, '/snow%20%E2%98%83'))
        .redirects(0)
        .end((err, res) => {
          expect(res.status).to.equal(301);
          expect(res.text).to.equal('Redirecting to <a href="/snow%20%E2%98%83/">/snow ☃/</a>');
          expect(res.headers).to.have.ownProperty('location', '/snow%20%E2%98%83/');
          expect(res.headers).to.have.ownProperty('content-type', 'text/html; charset=UTF-8');

          done();
        });
    });
  });

  describe('dir event', () => {
    it('should fire when request a dir without non match index', done => {
      const cb = holding(3, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('dir', function(realpath, next) {
            cb();
            this.status(403);
            next(this.statusMessage);
          })
          .pipe(res);
      });

      request.get(url(server, '/pets')).end((err, res) => {
        expect(res.status).to.equal(403);

        cb();
      });

      request.get(url(server, '/pets/')).end((err, res) => {
        expect(res.status).to.equal(403);

        cb();
      });
    });
  });

  describe('file event', () => {
    it('should fire when sending file', done => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('file', () => {
            cb();
          })
          .pipe(res);
      });

      request.get(url(server, '/nums')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('123456789');

        cb();
      });
    });
  });

  describe('error event', () => {
    it('should fire when on error', done => {
      const cb = holding(1, done);
      const server = http.createServer((req, res) => {
        new FileSend(req, pathname(req.url), { root: fixtures })
          .on('error', (error, next) => {
            cb();
            next();
          })
          .pipe(res);
      });

      request.get(url(server, '/nums-non-exists')).end((err, res) => {
        expect(res.status).to.equal(404);

        cb();
      });
    });
  });

  describe('with conditional-GET', () => {
    it('should respond with 304 on a match', done => {
      request.get(url(server, '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);

        request
          .get(url(server, '/name.txt'))
          .set('If-None-Match', res.headers['etag'])
          .set('If-Modified-Since', res.headers['last-modified'])
          .end((err, res) => {
            expect(res.status).to.equal(304);

            done();
          });
      });
    });

    describe('where "If-Match" is set', () => {
      it('should respond with 200 when "*"', done => {
        request
          .get(url(server, '/name.txt'))
          .set('If-Match', '*')
          .end((err, res) => {
            expect(res.status).to.equal(200);

            done();
          });
      });

      it('should respond with 412 when ETag unmatched', done => {
        request
          .get(url(server, '/name.txt'))
          .set('If-Match', '"foo", "bar"')
          .end((err, res) => {
            expect(res.status).to.equal(412);

            done();
          });
      });

      it('should respond with 200 when ETag matched', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-Match', '"foo", "bar", ' + res.headers['etag'])
            .end((err, res) => {
              expect(res.status).to.equal(200);

              done();
            });
        });
      });
    });

    describe('where "If-Modified-Since" is set', () => {
      it('should respond with 304 when unmodified', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-Modified-Since', res.headers['last-modified'])
            .end((err, res) => {
              expect(res.status).to.equal(304);

              done();
            });
        });
      });

      it('should respond with 200 when modified', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          const lmod = new Date(res.headers['last-modified']);
          const date = new Date(lmod - 60000);

          request
            .get(url(server, '/name.txt'))
            .set('If-Modified-Since', date.toUTCString())
            .end((err, res) => {
              expect(res.status).to.equal(200);

              done();
            });
        });
      });
    });

    describe('where "If-None-Match" is set', () => {
      it('should respond with 304 when ETag matched', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-None-Match', res.headers.etag)
            .end((err, res) => {
              expect(res.status).to.equal(304);

              done();
            });
        });
      });

      it('should respond with 200 when ETag unmatched', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-None-Match', '"123"')
            .end((err, res) => {
              expect(res.status).to.equal(200);

              done();
            });
        });
      });
    });

    describe('where "If-Unmodified-Since" is set', () => {
      it('should respond with 200 when unmodified', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          request
            .get(url(server, '/name.txt'))
            .set('If-Unmodified-Since', res.headers['last-modified'])
            .end((err, res) => {
              expect(res.status).to.equal(200);

              done();
            });
        });
      });

      it('should respond with 412 when modified', done => {
        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);

          const lmod = new Date(res.headers['last-modified']);
          const date = new Date(lmod - 60000).toUTCString();

          request
            .get(url(server, '/name.txt'))
            .set('If-Unmodified-Since', date)
            .end((err, res) => {
              expect(res.status).to.equal(412);

              done();
            });
        });
      });

      it('should respond with 200 when invalid date', done => {
        request
          .get(url(server, '/name.txt'))
          .set('If-Unmodified-Since', 'foo')
          .end((err, res) => {
            expect(res.status).to.equal(200);

            done();
          });
      });
    });
  });

  describe('with range request', () => {
    it('should support byte ranges', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-4')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('12345');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 0-4/9');

          done();
        });
    });

    it('should be inclusive', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-0')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('1');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 0-0/9');

          done();
        });
    });

    it('should set Content-Range', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=2-5')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('3456');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 2-5/9');

          done();
        });
    });

    it('should support -n', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=-3')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('789');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 6-8/9');

          done();
        });
    });

    it('should support n-', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=3-')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('456789');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 3-8/9');

          done();
        });
    });

    it('should respond with 206 "Partial Content"', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=0-4')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('12345');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 0-4/9');

          done();
        });
    });

    it('should set Content-Length to the # of octets transferred', done => {
      request
        .get(url(server, '/nums'))
        .set('Range', 'bytes=2-3')
        .end((err, res) => {
          expect(res.status).to.equal(206);
          expect(res.text).to.equal('34');
          expect(res.headers).to.have.ownProperty('content-length', '2');
          expect(res.headers).to.have.ownProperty('content-range', 'bytes 2-3/9');

          done();
        });
    });

    describe('when last-byte-pos of the range is greater the length', () => {
      it('is taken to be equal to one less than the length', done => {
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=2-50')
          .end((err, res) => {
            expect(res.status).to.equal(206);
            expect(res.text).to.equal('3456789');
            expect(res.headers).to.have.ownProperty('content-range', 'bytes 2-8/9');

            done();
          });
      });

      it('should adapt the Content-Length accordingly', done => {
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=2-50')
          .end((err, res) => {
            expect(res.status).to.equal(206);
            expect(res.text).to.equal('3456789');
            expect(res.headers).to.have.ownProperty('content-length', '7');
            expect(res.headers).to.have.ownProperty('content-range', 'bytes 2-8/9');

            done();
          });
      });
    });

    describe('when the first- byte-pos of the range is greater length', () => {
      it('should respond with 416', done => {
        request
          .get(url(server, '/nums'))
          .set('Range', 'bytes=9-50')
          .end((err, res) => {
            expect(res.status).to.equal(416);
            expect(res.text).to.include('Range Not Satisfiable');

            done();
          });
      });
    });

    describe('when syntactically invalid', () => {
      it('should respond with 200 and the entire contents', done => {
        request
          .get(url(server, '/nums'))
          .set('Range', 'asdf')
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.text).to.equal('123456789');

            done();
          });
      });
    });

    describe('when multiple ranges', () => {
      it('should respond with 206 and the range contents', done => {
        let address = server.address();

        if (!address) {
          server.listen();

          address = server.address();
        }

        const options = {
          hostname: '127.0.0.1',
          port: address.port,
          path: '/nums',
          method: 'GET',
          keepAlive: true,
          headers: {
            Range: 'bytes=1-1,3-',
            'Cache-Control': 'no-cache'
          }
        };

        const req = http.request(options, res => {
          let data;

          res.on('data', chunk => {
            if (!data) {
              data = chunk;
            } else {
              data = Buffer.concat([data, chunk]);
            }
          });

          res.on('close', () => {
            const contentType = res.headers['content-type'];
            const boundary = /^multipart\/byteranges; boundary=(<[^<>]+>)$/.exec(contentType)[1];

            expect(res.statusCode).to.equal(206);
            expect(contentType).to.match(/^multipart\/byteranges; boundary=<[^<>]+>$/);
            expect(data.toString()).to.include(boundary);

            done();
          });
        });

        req.on('error', err => {
          done(err);
        });

        req.end();
      });
    });

    describe('when if-range present', () => {
      it('should respond with parts when etag unchanged', done => {
        request.get(url(server, '/nums')).end((err, res) => {
          expect(res.status).to.equal(200);

          const etag = res.headers['etag'];

          request
            .get(url(server, '/nums'))
            .set('If-Range', etag)
            .set('Range', 'bytes=0-0')
            .end((err, res) => {
              expect(res.status).to.equal(206);
              expect(res.text).to.equal('1');

              done();
            });
        });
      });

      it('should respond with 200 when etag changed', done => {
        request.get(url(server, '/nums')).end((err, res) => {
          expect(res.status).to.equal(200);

          const etag = res.headers['etag'].replace(/"(.)/, '"0$1');

          request
            .get(url(server, '/nums'))
            .set('If-Range', etag)
            .set('Range', 'bytes=0-0')
            .end((err, res) => {
              expect(res.status).to.equal(200);
              expect(res.text).to.equal('123456789');

              done();
            });
        });
      });

      it('should respond with parts when modified unchanged', done => {
        request.get(url(server, '/nums')).end((err, res) => {
          expect(res.status).to.equal(200);

          const modified = res.headers['last-modified'];

          request
            .get(url(server, '/nums'))
            .set('If-Range', modified)
            .set('Range', 'bytes=0-0')
            .end((err, res) => {
              expect(res.status).to.equal(206);
              expect(res.text).to.equal('1');

              done();
            });
        });
      });

      it('should respond with 200 when modified changed', done => {
        request.get(url(server, '/nums')).end((err, res) => {
          expect(res.status).to.equal(200);

          const modified = Date.parse(res.headers['last-modified']) - 20000;

          request
            .get(url(server, '/nums'))
            .set('If-Range', new Date(modified).toUTCString())
            .set('Range', 'bytes=0-0')
            .end((err, res) => {
              expect(res.status).to.equal(200);
              expect(res.text).to.equal('123456789');

              done();
            });
        });
      });
    });
  });
});

describe('Options', () => {
  describe('acceptRanges', () => {
    it('should support disabling accept-ranges', done => {
      request.get(url(createServer({ acceptRanges: false, root: fixtures }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.not.have.ownProperty('accept-ranges');
        expect(res.headers).to.not.have.ownProperty('content-range');

        done();
      });
    });

    it('should ignore requested range', done => {
      request
        .get(url(createServer({ acceptRanges: false, root: fixtures }), '/nums'))
        .set('Range', 'bytes=0-2')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.headers).to.not.have.ownProperty('accept-ranges');
          expect(res.headers).to.not.have.ownProperty('content-range');
          expect(res.text).to.equal('123456789');

          done();
        });
    });
  });

  describe('root', () => {
    it('should join root', done => {
      request.get(url(createServer({ root: fixtures }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');

        done();
      });
    });

    it('should work with trailing slash', done => {
      request.get(url(createServer({ root: fixtures + '/' }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');

        done();
      });
    });

    it('should restrict paths to within root', done => {
      request.get(url(createServer({ root: fixtures }), '/pets/../../index.js')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
    });

    it('should allow .. in root', done => {
      request.get(url(createServer({ root: __dirname + '/fixtures/../fixtures' }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');

        done();
      });
    });

    it('should not allow root transversal', done => {
      request.get(url(createServer({ root: fixtures + '/name.d' }), '/../name.dir/name.txt')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
    });
  });

  describe('cacheControl', () => {
    it('should support disabling cache-control', done => {
      request.get(url(createServer({ cacheControl: false, root: fixtures }), '/nums')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.not.have.ownProperty('cache-control');

        done();
      });
    });

    it('should ignore maxAge option', done => {
      request.get(url(createServer({ cacheControl: false, maxAge: 1000, root: fixtures }), '/nums')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.headers).to.not.have.ownProperty('cache-control');

        done();
      });
    });
  });

  describe('etag', () => {
    it('should support disabling etags', done => {
      request.get(url(createServer({ root: fixtures, etag: false }), '/nums')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('123456789');
        expect(res.headers).to.not.have.ownProperty('etag');

        done();
      });
    });
  });

  describe('charset', () => {
    it('should default no charset', done => {
      request.get(url(server, '/tobi.html')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('<p>tobi</p>');
        expect(res.headers['content-type']).to.not.include('charset');

        done();
      });
    });

    it('should can set charset', done => {
      request.get(url(createServer({ charset: 'utf-8', root: fixtures }), '/tobi.html')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('<p>tobi</p>');
        expect(res.headers['content-type']).to.include('charset=utf-8');

        done();
      });
    });
  });

  describe('ignore', () => {
    it('should default no ignore', done => {
      const cb = holding(1, done);

      request.get(url(server, '/.hidden')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('secret\n');

        cb();
      });

      request.get(url(server, '/.mine/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');

        cb();
      });
    });

    it('should can ignore match', done => {
      const cb = holding(1, done);
      const server = createServer({ root: fixtures, ignore: ['**/.*?(/*)'] });

      request.get(url(server, '/.hidden')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        cb();
      });

      request.get(url(server, '/.mine/name.txt')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        cb();
      });
    });
  });

  describe('ignoreAccess', () => {
    describe('should default to "deny"', () => {
      const server = createServer({ root: fixtures, ignore: ['**/.*?(/*)'] });

      it('should 403 for ignore', done => {
        request.get(url(server, '/.hidden')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should 403 for ignore directory', done => {
        request.get(url(server, '/.mine')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should 403 for ignore directory with trailing slash', done => {
        request.get(url(server, '/.mine/')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should 403 for file within ignore directory', done => {
        request.get(url(server, '/.mine/name.txt')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should 403 for non-existent ignore', done => {
        request.get(url(server, '/.nothere')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should 403 for non-existent ignore directory', done => {
        request.get(url(server, '/.what/name.txt')).end((err, res) => {
          expect(res.forbidden).to.be.true;

          done();
        });
      });

      it('should skip ignore index', done => {
        const server = createServer({
          root: fixtures,
          index: ['name.txt', 'name.html'],
          ignore: ['**/name.txt']
        });

        request.get(url(server, '/')).end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('<p>tobi</p>');

          done();
        });
      });

      it('should send files in root ignore directory', done => {
        request.get(url(createServer({ root: fixtures + '/.mine', ignore: ['**/.*?(/*)'] }), '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          done();
        });
      });
    });

    describe('when "ignore"', () => {
      const server = createServer({ root: fixtures, ignore: ['**/.*?(/**)'], ignoreAccess: 'ignore' });

      it('should 404 for ignore', done => {
        request.get(url(server, '/.hidden')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should 404 for ignore directory', done => {
        request.get(url(server, '/.mine')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should 404 for ignore directory with trailing slash', done => {
        request.get(url(server, '/.mine/')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should 404 for file within ignore directory', done => {
        request.get(url(server, '/.mine/name.txt')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should 404 for non-existent ignore', done => {
        request.get(url(server, '/.nothere')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should 404 for non-existent ignore directory', done => {
        request.get(url(server, '/.what/name.txt')).end((err, res) => {
          expect(res.notFound).to.be.true;

          done();
        });
      });

      it('should send files in root ignore directory', done => {
        const server = createServer({ root: fixtures + '/.mine', ignore: ['**/.*?(/*)'], ignoreAccess: 'ignore' });

        request.get(url(server, '/name.txt')).end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.text).to.equal('tobi');

          done();
        });
      });
    });
  });

  describe('index', () => {
    it('should default no index', done => {
      request.get(url(server, '/pets/')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
    });

    it('should be configurable', done => {
      request.get(url(createServer({ root: fixtures, index: 'tobi.html' }), '/')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('<p>tobi</p>');

        done();
      });
    });

    it('should support disabling', done => {
      request.get(url(createServer({ root: fixtures, index: false }), '/pets/')).end((err, res) => {
        expect(res.forbidden).to.be.true;

        done();
      });
    });

    it('should support fallbacks', done => {
      request.get(url(createServer({ root: fixtures, index: ['default.htm', 'index.html'] }), '/pets/')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.include('tobi');

        done();
      });
    });

    it('should not follow directories', done => {
      request.get(url(createServer({ root: fixtures, index: ['pets', 'name.txt'] }), '/')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.include('tobi');

        done();
      });
    });
  });

  describe('lastModified', () => {
    it('should support disabling last-modified', done => {
      const server = createServer({ root: fixtures, lastModified: false });

      request.get(url(server, '/nums')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('123456789');
        expect(res.headers).to.not.have.ownProperty('last-modified');

        done();
      });
    });
  });

  describe('maxAge', () => {
    it('should default to 0', done => {
      request.get(url(server, '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=0');

        done();
      });
    });

    it('should floor to integer', done => {
      request.get(url(createServer({ root: fixtures, maxAge: 123.956 }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=123');

        done();
      });
    });

    it('should accept string', done => {
      request.get(url(createServer({ root: fixtures, maxAge: '30d' }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=2592000');

        done();
      });
    });

    it('should max at 1 year', done => {
      request.get(url(createServer({ root: fixtures, maxAge: Infinity }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=31536000');

        done();
      });
    });
  });

  describe('immutable', () => {
    it('should default to false', done => {
      request.get(url(server, '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=0');

        done();
      });
    });

    it('should set immutable directive in Cache-Control', done => {
      request.get(url(createServer({ immutable: true, maxAge: '1h', root: fixtures }), '/name.txt')).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('tobi');
        expect(res.headers).to.have.ownProperty('cache-control', 'public, max-age=3600, immutable');

        done();
      });
    });
  });
});

describe('FileSend.mime', () => {
  it('should be exposed', () => {
    expect(FileSend.mime).to.be.ok;
  });
});

function createServer(opts) {
  const server = http.createServer((req, res) => {
    try {
      new FileSend(req, pathname(req.url), opts).pipe(res);
    } catch (err) {
      res.statusCode = 500;

      res.end(String(err));
    }
  });

  server.listen();

  return server;
}
