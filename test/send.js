var after = require('after');
var assert = require('assert');
var fs = require('fs');
var http = require('http');
var path = require('path');
var request = require('supertest');
var Send = require('../index');
var util = require('../lib/util');
var through = require('../lib/through');

util.isType(NaN, 'nan');
util.isType(new Error(), 'error');
(through()).destroy();

try {
  Send('');
} catch (e) {}

// test server
var dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/;
var fixtures = path.join(__dirname, 'fixtures');
var app = http.createServer(function (req, res){
  Send(req, { root: fixtures })
    .on('dir', function (response, realpath, stats, next){
      this.status(403);
      next(this.statusMessage);
    })
    .on('end', function (){ })
    .on('close', function (){ })
    .pipe(res);
});

describe('Send(req, options)', function (){
  it('should stream the file contents', function (done){
    request(app)
      .get('/name.txt')
      .expect('Content-Length', '4')
      .expect(200, 'tobi', done);
  });

  it('should stream a zero-length file', function (done){
    request(app)
      .get('/empty.txt')
      .expect('Content-Length', '0')
      .expect(200, '', done);
  });

  it('should decode the given path as a URI', function (done){
    request(app)
      .get('/some%20thing.txt')
      .expect(200, 'hey', done);
  });

  it('should serve files with dots in name', function (done){
    request(app)
      .get('/do..ts.txt')
      .expect(200, '...', done);
  });

  it('should treat a malformed URI as a bad request', function (done){
    request(app)
      .get('/some%99thing.txt')
      .expect(400, 'Bad Request', done);
  });

  it('should 400 on NULL bytes', function (done){
    request(app)
      .get('/some%00thing.txt')
      .expect(400, 'Bad Request', done);
  });

  it('should treat an ENAMETOOLONG as a 404', function (done){
    var path = new Array(100).join('foobar');
    request(app)
      .get('/' + path)
      .expect(404, done);
  });

  it('should handle headers already sent error', function (done){
    var app = http.createServer(function (req, res){
      res.write('0');
      Send(req).pipe(res);
    });

    request(app)
      .get('/nums')
      .expect(200, '0Can\'t set headers after they are sent.', done);
  });

  it('should support HEAD', function (done){
    request(app)
      .head('/name.txt')
      .expect('Content-Length', '4')
      .expect(200, '', done);
  });

  it('should add an ETag header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('etag', /\S+/)
      .end(done);
  });

  it('should add a Date header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('date', dateRegExp, done);
  });

  it('should add a Last-Modified header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('last-modified', dateRegExp, done);
  });

  it('should add a Accept-Ranges header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('Accept-Ranges', 'bytes', done);
  });

  it('should 404 if the file does not exist', function (done){
    request(app)
      .get('/meow')
      .expect(404, 'Not Found', done);
  });

  it('should 404 if the file with trailing slash', function (done){
    request(app)
      .get('/nums/')
      .expect(404, 'Not Found', done);
  });

  it('should 301 if the directory exists', function (done){
    request(app)
      .get('/pets')
      .expect('Location', '/pets/')
      .expect(301, 'Redirecting to <a href="/pets/">/pets/</a>', done);
  });

  it('should not override content-type', function (done){
    var app = http.createServer(function (req, res){
      res.setHeader('Content-Type', 'application/x-custom');
      Send(req, { root: fixtures }).pipe(res);
    });

    request(app)
      .get('/nums')
      .expect('Content-Type', 'application/x-custom', done);
  });

  it('should set Content-Type via mime map', function (done){
    request(app)
      .get('/name.txt')
      .expect('Content-Type', 'text/plain')
      .expect(200, function (err){
        if (err) return done(err);

        request(app)
          .get('/tobi.html')
          .expect('Content-Type', 'text/html')
          .expect(200, function (err){
            if (err) return done(err);

            request(app)
              .get('/zip.zip')
              .expect('Content-Type', 'application/zip')
              .expect(200, done)
          })
      });
  });

  it('should 404 if the directory not exists', function (done){
    request(app)
      .get('/what/')
      .expect(404, 'Not Found', done);
  });

  it('should 403 if the directory exists', function (done){
    request(app)
      .get('/name.d/')
      .expect(403, 'Forbidden', done);
  });

  it('should 404 if file disappears after stat, before open', function (done){
    var app = http.createServer(function (req, res){
      var send = Send(req);

      // simulate file ENOENT after on open, after stat
      var fn = this.send;

      send.createReadStream = function (){
        send.realpath += '__xxx_no_exist';
        fn.apply(this, arguments);
      };

      send.pipe(res);
    });

    request(app)
      .get('/name.txt')
      .expect(404, done);
  });

  it('should 500 on file stream error', function (done){
    var app = http.createServer(function (req, res){
      Send(req, { root: fixtures })
        .pipe(through())
        .pipe(through(function (chunk, enc, next){
          // simulate file error
          process.nextTick(function (){
            next(new Error('boom!'));
          });
        }))
        .pipe(res);
    });

    request(app)
      .get('/name.txt')
      .expect(500, done);
  });

  describe('"headers" event', function (){
    it('should fire when sending file', function (done){
      var cb = after(2, done);
      var server = http.createServer(function (req, res){
        res.setHeader('Cache-Control', 'private');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('ETag', '"9-150f5bc45c8"');
        res.setHeader('Last-Modified', 'Wed, 11 Nov 2015 08:49:28 GMT');

        Send(req, { root: fixtures })
          .on('headers', function (){
            this.setHeader('Server', 'nengine');
            this.removeHeader('Server');
            cb();
          })
          .pipe(res);
      });

      request(server)
        .get('/nums')
        .expect(200, '123456789', cb);
    });

    it('should not fire on 404', function (done){
      var cb = after(1, done);
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .on('headers', function (){ cb() })
          .pipe(res);
      });

      request(server)
        .get('/bogus')
        .expect(404, cb);
    });

    it('should fire on index', function (done){
      var cb = after(1, done);
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['index.html'] })
          .on('headers', function (){ cb() })
          .pipe(res);
      });

      request(server)
        .get('/pets/')
        .expect(200, /tobi/, cb);
    });

    it('should not fire on redirect', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .pipe(res);
      });

      request(server)
        .get('/pets')
        .expect(301, done);
    });

    it('should allow altering headers', function (done){
      var server = http.createServer(function (req, res){
        Send(req, { root: fixtures })
          .on('headers', onHeaders)
          .pipe(res);
      });

      function onHeaders(){
        this.setHeader('Cache-Control', 'no-cache');
        this.setHeader('Content-Type', 'text/x-custom');
        this.setHeader('ETag', 'W/"everything"');
        this.setHeader('X-Created', fs.statSync(this.realpath).ctime.toUTCString());
      }

      request(server)
        .get('/nums')
        .expect('Cache-Control', 'no-cache')
        .expect('Content-Type', 'text/x-custom')
        .expect('ETag', 'W/"everything"')
        .expect('X-Created', dateRegExp)
        .expect(200, '123456789', done);
    });
  });

  describe('when no "dir" listeners are present', function (){
    var server;

    before(function (){
      server = http.createServer(function (req, res){
        Send(req, { root: fixtures }).pipe(res);
      });
    });

    it('should respond with an HTML redirect', function (done){
      request(server)
        .get('/pets')
        .expect('Location', '/pets/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect(301, 'Redirecting to <a href="/pets/">/pets/</a>', done);
    });
  });

  describe('when no "error" listeners are present', function (){
    it('should respond to errors directly', function (done){
      var app = http.createServer(function (req, res){
        Send(req, { root: 'test/fixtures' + req.url }).pipe(res);
      });

      request(app)
        .get('/foobar')
        .expect(404, 'Not Found', done);
    })
  });

  describe('with conditional-GET', function (){
    it('should respond with 304 on a match', function (done){
      request(app)
        .get('/name.txt')
        .expect(200, function (err, res){
          if (err) return done(err);

          request(app)
            .get('/name.txt')
            .set('If-None-Match', res.headers['etag'])
            .set('If-Modified-Since', res.headers['last-modified'])
            .expect(shouldHaveHeader('Content-Length'))
            .expect(shouldHaveHeader('Content-Type'))
            .expect(304, done);
        });
    });

    it('should respond with 200 otherwise', function (done){
      request(app)
        .get('/name.txt')
        .expect(200, function (err, res){
          if (err) return done(err);

          request(app)
            .get('/name.txt')
            .set('If-None-Match', '"123"')
            .expect(200, 'tobi', done);
        });
    });
  });

  describe('with range request', function (){
    it('should support byte ranges', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-4')
        .expect(206, '12345', done);
    });

    it('should be inclusive', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-0')
        .expect(206, '1', done);
    });

    it('should set Content-Range', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=2-5')
        .expect('Content-Range', 'bytes 2-5/9')
        .expect(206, done);
    });

    it('should support -n', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=-3')
        .expect(206, '789', done);
    });

    it('should support n-', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=3-')
        .expect(206, '456789', done);
    });

    it('should respond with 206 "Partial Content"', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-4')
        .expect(206, done);
    });

    it('should set Content-Length to the # of octets transferred', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=2-3')
        .expect('Content-Length', '2')
        .expect(206, '34', done);
    });

    describe('when last-byte-pos of the range is greater the length', function (){
      it('is taken to be equal to one less than the length', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=2-50')
          .expect('Content-Range', 'bytes 2-8/9')
          .expect(206, done);
      });

      it('should adapt the Content-Length accordingly', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=2-50')
          .expect('Content-Length', '7')
          .expect(206, done);
      });
    });

    describe('when the first- byte-pos of the range is greater length', function (){
      it('should respond with 416', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=9-50')
          .expect('Content-Range', 'bytes */9')
          .expect(416, done);
      });
    });

    describe('when syntactically invalid', function (){
      it('should respond with 200 and the entire contents', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'asdf')
          .expect(200, '123456789', done);
      });
    });

    describe('when multiple ranges', function (){
      it('should respond with 206 and the range contents', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=1-1,3-')
          .expect('Content-Type', /^multipart\/byteranges; boundary=<[^<>]+>$/)
          .expect(206, done);
      });
    });

    describe('when if-range present', function (){
      it('should respond with parts when etag unchanged', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var etag = res.headers.etag;

            request(app)
              .get('/nums')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', done);
          });
      });

      it('should respond with 200 when etag changed', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var etag = res.headers.etag.replace(/"(.)/, '"0$1');

            request(app)
              .get('/nums')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', done);
          });
      });

      it('should respond with parts when modified unchanged', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);
            var modified = res.headers['last-modified'];

            request(app)
              .get('/nums')
              .set('If-Range', modified)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', done);
          });
      });

      it('should respond with 200 when modified changed', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);
            var modified = Date.parse(res.headers['last-modified']) - 20000;

            request(app)
              .get('/nums')
              .set('If-Range', new Date(modified).toUTCString())
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', done);
          });
      });
    });
  });
});

describe('Options', function (){
  describe('root', function (){
    it('should join root', function (done){
      request(createServer(fixtures))
        .get('/pets/../name.txt')
        .expect(200, 'tobi', done);
    });

    it('should work with trailing slash', function (done){
      request(createServer(fixtures + '/'))
        .get('/name.txt')
        .expect(200, 'tobi', done);
    });

    it('should restrict paths to within root', function (done){
      request(createServer(fixtures))
        .get('/pets/../../send.js')
        .expect(403, done);
    });

    it('should allow .. in root', function (done){
      request(createServer(__dirname + '/fixtures/../fixtures'))
        .get('/name.txt')
        .expect(200, done);
    });

    it('should not allow root transversal', function (done){
      request(createServer(__dirname + '/fixtures/name.d'))
        .get('/../name.dir/name.txt')
        .expect(403, done);
    });
  });

  describe('etag', function (){
    it('should support disabling etags', function (done){
      var app = createServer(fixtures, { 'etag': false });

      request(app)
        .get('/nums')
        .expect(shouldNotHaveHeader('ETag'))
        .expect(200, done);
    });
  });

  describe('ignore', function (){
    it('should default no ignore', function (done){
      var server = createServer(fixtures);

      request(server)
        .get('/.hidden')
        .expect(200);

      request(server)
        .get('/.mine/name.txt')
        .expect(200, done);
    });

    it('should can ignore match', function (done){
      var server = createServer(fixtures, { ignore: ['/**/.*?(/*.*|/)'] });

      request(server)
        .get('/.hidden')
        .expect(403);

      request(server)
        .get('/.mine/name.txt')
        .expect(403, done);
    });
  });

  describe('ignoreAccess', function (){
    describe('should default to "deny"', function (){
      var server = createServer(fixtures, { ignore: ['/**/.*?(/*.*|/)'] });

      it('should 403 for ignore', function (done){
        request(server)
          .get('/.hidden')
          .expect(403, done);
      });

      it('should 403 for ignore directory', function (done){
        request(server)
          .get('/.mine')
          .expect(403, done);
      });

      it('should 403 for ignore directory with trailing slash', function (done){
        request(server)
          .get('/.mine/')
          .expect(403, done);
      });

      it('should 403 for file within ignore directory', function (done){
        request(server)
          .get('/.mine/name.txt')
          .expect(403, done);
      });

      it('should 403 for non-existent ignore', function (done){
        request(server)
          .get('/.nothere')
          .expect(403, done);
      });

      it('should 403 for non-existent ignore directory', function (done){
        request(server)
          .get('/.what/name.txt')
          .expect(403, done);
      });

      it('should 403 for ignore index', function (done){
        request(createServer(fixtures, {
          index: ['name.txt'],
          ignore: ['/**/name.txt']
        })).get('/').expect(403, done);
      });

      it('should send files in root ignore directory', function (done){
        request(createServer(path.join(fixtures, '.mine'), { ignore: ['/**/.*?(/*.*|/)'] }))
          .get('/name.txt')
          .expect(200, /tobi/, done);
      });
    });

    describe('when "ignore"', function (){
      var server = createServer(fixtures, { ignore: ['/**/.*?(/*.*|/)'], ignoreAccess: 'ignore' });

      it('should 404 for ignore', function (done){
        request(server)
          .get('/.hidden')
          .expect(404, done)
      });

      it('should 404 for ignore directory', function (done){
        request(server)
          .get('/.mine')
          .expect(404, done);
      });

      it('should 404 for ignore directory with trailing slash', function (done){
        request(server)
          .get('/.mine/')
          .expect(404, done);
      });

      it('should 404 for file within ignore directory', function (done){
        request(server)
          .get('/.mine/name.txt')
          .expect(404, done);
      });

      it('should 404 for non-existent ignore', function (done){
        request(server)
          .get('/.nothere')
          .expect(404, done);
      });

      it('should 404 for non-existent ignore directory', function (done){
        request(server)
          .get('/.what/name.txt')
          .expect(404, done);
      });

      it('should send files in root ignore directory', function (done){
        request(createServer(path.join(fixtures, '.mine'), { ignore: ['/**/.*?(/*.*|/)'], ignoreAccess: 'ignore' }))
          .get('/name.txt')
          .expect(200, /tobi/, done);
      });
    });
  });

  describe('index', function (){
    it('should default no index', function (done){
      request(app)
        .get('/pets/')
        .expect(403, done)
    });

    it('should be configurable', function (done){
      var cb = after(1, done);

      var app = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: 'tobi.html' })
          .on('headers', function (){
            cb();
          })
          .pipe(res);
      });

      request(app)
        .get('/')
        .expect(200, '<p>tobi</p>', cb);
    });

    it('should support disabling', function (done){
      var app = createServer(fixtures, { index: false });

      request(app)
        .get('/pets/')
        .expect(403, done);
    });

    it('should support fallbacks', function (done){
      var cb = after(1, done);

      var app = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['default.htm', 'index.html'] })
          .on('headers', function (){
            cb();
          })
          .pipe(res);
      });

      request(app)
        .get('/pets/')
        .expect(200, fs.readFileSync(path.join(fixtures, 'pets', 'index.html'), 'utf8'), cb);
    });

    it('should not follow directories', function (done){
      var cb = after(1, done);

      var app = http.createServer(function (req, res){
        Send(req, { root: fixtures, index: ['pets', 'name.txt'] })
          .on('headers', function (){
            cb();
          })
          .pipe(res);
      });

      request(app)
        .get('/')
        .expect(200, 'tobi', cb);
    });
  });

  describe('lastModified', function (){
    it('should support disabling last-modified', function (done){
      var app = createServer(fixtures, { lastModified: false });

      request(app)
        .get('/nums')
        .expect(shouldNotHaveHeader('Last-Modified'))
        .expect(200, done)
    })
  });

  describe('maxAge', function (){
    it('should default to 0', function (done){
      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'private', done);
    });

    it('should floor to integer', function (done){
      var app = createServer(fixtures, { maxAge: 123.956 });

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=123', done);
    });

    it('should accept string', function (done){
      var app = createServer(fixtures, { maxAge: '30d' });

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=2592000', done);
    });

    it('should max at 1 year', function (done){
      var app = createServer(fixtures, { maxAge: Infinity });

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=31536000', done);
    });
  });
});

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

function shouldHaveHeader(header){
  return function (res){
    assert.ok(res.headers.hasOwnProperty(header.toLowerCase()), 'should have header ' + header);
  }
}

function shouldNotHaveHeader(header){
  return function (res){
    assert.ok(!res.headers.hasOwnProperty(header.toLowerCase()), 'should not have header ' + header);
  }
}
